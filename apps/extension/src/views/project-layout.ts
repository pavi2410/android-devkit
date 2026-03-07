import * as vscode from "vscode";
import {
  collectAndroidGradleScripts,
  detectAndroidModules,
  inspectAndroidModule,
  listDirectoryChildren,
} from "@android-devkit/android-project";
import { VS_CODE_COMMANDS } from "../commands/ids";

type ProjectLayoutItem =
  | ModuleItem
  | CategoryItem
  | SourceRootItem
  | PackageItem
  | ResTypeItem
  | FileItem
  | GradleScriptsItem
  | GradleScriptItem
  | MessageItem;

export class ProjectLayoutProvider implements vscode.TreeDataProvider<ProjectLayoutItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ProjectLayoutItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private watchers: vscode.FileSystemWatcher[] = [];

  constructor() {
    this.setupWatchers();
  }

  private setupWatchers(): void {
    const patterns = [
      "**/*.gradle",
      "**/*.gradle.kts",
      "**/AndroidManifest.xml",
      "**/settings.gradle",
      "**/settings.gradle.kts",
    ];
    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      watcher.onDidCreate(() => this.refresh());
      watcher.onDidDelete(() => this.refresh());
      watcher.onDidChange(() => this.refresh());
      this.watchers.push(watcher);
    }
  }

  dispose(): void {
    for (const w of this.watchers) w.dispose();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProjectLayoutItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProjectLayoutItem): Promise<ProjectLayoutItem[]> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      return [new MessageItem("No workspace folder open")];
    }

    if (!element) {
      return this.getRootItems(root);
    }

    if (element instanceof ModuleItem) {
      return this.getModuleChildren(element);
    }
    if (element instanceof CategoryItem) {
      return this.getCategoryChildren(element);
    }
    if (element instanceof SourceRootItem) {
      return this.getPackageChildren(element.fsPath, element.fsPath);
    }
    if (element instanceof PackageItem) {
      return this.getPackageChildren(element.fsPath, element.rootFsPath);
    }
    if (element instanceof ResTypeItem) {
      return this.getResTypeChildren(element.fsPath);
    }
    if (element instanceof GradleScriptsItem) {
      return element.scripts;
    }

    return [];
  }

  private async getRootItems(root: string): Promise<ProjectLayoutItem[]> {
    const modules = detectAndroidModules(root);
    const items: ProjectLayoutItem[] = modules.map((m) => new ModuleItem(m.name, m.fsPath));

    const gradleScripts = collectAndroidGradleScripts(root)
      .map((script) => new GradleScriptItem(script.label, script.fsPath, script.context));
    if (gradleScripts.length > 0) {
      items.push(new GradleScriptsItem(gradleScripts));
    }

    if (items.length === 0) {
      return [new MessageItem("No Android modules detected")];
    }

    return items;
  }

  private getModuleChildren(module: ModuleItem): ProjectLayoutItem[] {
    const inspection = inspectAndroidModule(module.fsPath);
    const items: ProjectLayoutItem[] = [];

    if (inspection.manifestPath) {
      items.push(new CategoryItem("manifests", "manifests", module.fsPath, CategoryKind.Manifests));
    }

    const hasJava = inspection.sourceRoots.some((root) => /[\\/]src[\\/]main[\\/]java[\\/]/.test(root.fsPath));
    const hasKotlin = inspection.sourceRoots.some((root) => /[\\/]src[\\/]main[\\/]kotlin[\\/]/.test(root.fsPath));
    if (hasJava || hasKotlin) {
      const label = hasKotlin && hasJava ? "kotlin+java" : hasKotlin ? "kotlin" : "java";
      items.push(new CategoryItem(label, label, module.fsPath, CategoryKind.Sources));
    }

    if (inspection.resourceDirectories.length > 0) {
      items.push(new CategoryItem("res", "res", module.fsPath, CategoryKind.Res));
    }

    if (inspection.generatedResourceDirectories.length > 0) {
      const cat = new CategoryItem("res (generated)", "res (generated)", module.fsPath, CategoryKind.ResGenerated);
      items.push(cat);
    }

    return items;
  }

  private getCategoryChildren(cat: CategoryItem): ProjectLayoutItem[] {
    const inspection = inspectAndroidModule(cat.moduleFsPath);

    switch (cat.kind) {
      case CategoryKind.Manifests: {
        return inspection.manifestPath
          ? [new FileItem("AndroidManifest.xml", inspection.manifestPath)]
          : [];
      }

      case CategoryKind.Sources: {
        return inspection.sourceRoots.map((root) =>
          new SourceRootItem(root.packageName, root.fsPath, root.sourceSet)
        );
      }

      case CategoryKind.Res: {
        return inspection.resourceDirectories
          .map((dir) => new ResTypeItem(getPathLabel(dir), dir));
      }

      case CategoryKind.ResGenerated: {
        return inspection.generatedResourceDirectories
          .map((dir) => new ResTypeItem(getPathLabel(dir), dir));
      }
    }
  }

  private getPackageChildren(dir: string, rootDir: string): ProjectLayoutItem[] {
    return listDirectoryChildren(dir).map((entry) =>
      entry.isDirectory
        ? new PackageItem(entry.name, entry.fsPath, rootDir)
        : new FileItem(entry.name, entry.fsPath)
    );
  }

  private getResTypeChildren(dir: string): ProjectLayoutItem[] {
    return listDirectoryChildren(dir)
      .map((entry) => new FileItem(entry.name, entry.fsPath));
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPathLabel(fsPath: string): string {
  const parts = fsPath.split(/[/\\]/);
  return parts[parts.length - 1] ?? fsPath;
}

// ── Node kinds ─────────────────────────────────────────────────────────────

enum CategoryKind {
  Manifests,
  Sources,
  Res,
  ResGenerated,
}

class ModuleItem extends vscode.TreeItem {
  constructor(
    public readonly moduleName: string,
    public readonly fsPath: string
  ) {
    super(moduleName, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon("package");
    this.contextValue = "androidModule";
    this.resourceUri = vscode.Uri.file(fsPath);
  }
}

class CategoryItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly categoryName: string,
    public readonly moduleFsPath: string,
    public readonly kind: CategoryKind
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon("folder");
    this.contextValue = "androidCategory";
  }
}

class SourceRootItem extends vscode.TreeItem {
  constructor(
    packageName: string,
    public readonly fsPath: string,
    sourceSet?: string
  ) {
    super(packageName, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = sourceSet ? `(${sourceSet})` : undefined;
    this.iconPath = new vscode.ThemeIcon("symbol-namespace");
    this.contextValue = "androidSourceRoot";
    this.resourceUri = vscode.Uri.file(fsPath);
  }
}

class PackageItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly fsPath: string,
    public readonly rootFsPath: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("symbol-namespace");
    this.contextValue = "androidPackage";
    this.resourceUri = vscode.Uri.file(fsPath);
  }
}

class ResTypeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly fsPath: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("symbol-color");
    this.contextValue = "androidResType";
    this.resourceUri = vscode.Uri.file(fsPath);
  }
}

class FileItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly fsPath: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.resourceUri = vscode.Uri.file(fsPath);
    this.iconPath = vscode.ThemeIcon.File;
    this.contextValue = "androidFile";
    this.command = {
      command: VS_CODE_COMMANDS.open,
      title: "Open File",
      arguments: [vscode.Uri.file(fsPath)],
    };
  }
}

class GradleScriptsItem extends vscode.TreeItem {
  constructor(public readonly scripts: GradleScriptItem[]) {
    super("Gradle Scripts", vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("settings-gear");
    this.contextValue = "androidGradleScripts";
  }
}

class GradleScriptItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly fsPath: string,
    context?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = context;
    this.resourceUri = vscode.Uri.file(fsPath);
    this.iconPath = vscode.ThemeIcon.File;
    this.contextValue = "androidGradleScript";
    this.command = {
      command: VS_CODE_COMMANDS.open,
      title: "Open File",
      arguments: [vscode.Uri.file(fsPath)],
    };
  }
}

class MessageItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("info");
  }
}
