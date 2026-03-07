import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
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
    const modules = this.detectModules(root);
    const items: ProjectLayoutItem[] = modules.map((m) => new ModuleItem(m.name, m.fsPath));

    const gradleScripts = this.collectGradleScripts(root);
    if (gradleScripts.length > 0) {
      items.push(new GradleScriptsItem(gradleScripts));
    }

    if (items.length === 0) {
      return [new MessageItem("No Android modules detected")];
    }

    return items;
  }

  private detectModules(root: string): { name: string; fsPath: string }[] {
    const modules: { name: string; fsPath: string }[] = [];

    const settingsFiles = [
      path.join(root, "settings.gradle.kts"),
      path.join(root, "settings.gradle"),
    ];

    let parsed = false;
    for (const sf of settingsFiles) {
      if (!fs.existsSync(sf)) continue;
      const content = fs.readFileSync(sf, "utf8");
      const includeMatches = [...content.matchAll(/include\s*\(\s*["']([^"']+)["']\s*\)/g)];
      for (const m of includeMatches) {
        const modPath = m[1].replace(/^:/, "").replace(/:/g, path.sep);
        const modFsPath = path.join(root, modPath);
        if (fs.existsSync(modFsPath)) {
          modules.push({ name: m[1].replace(/^:/, ""), fsPath: modFsPath });
        }
      }
      if (modules.length > 0) { parsed = true; break; }
    }

    if (!parsed) {
      for (const entry of safeReadDir(root)) {
        const full = path.join(root, entry);
        if (
          fs.statSync(full).isDirectory() &&
          (fs.existsSync(path.join(full, "build.gradle.kts")) ||
            fs.existsSync(path.join(full, "build.gradle")))
        ) {
          modules.push({ name: entry, fsPath: full });
        }
      }
    }

    return modules;
  }

  private getModuleChildren(module: ModuleItem): ProjectLayoutItem[] {
    const items: ProjectLayoutItem[] = [];
    const srcMain = path.join(module.fsPath, "src", "main");

    const manifestPath = path.join(srcMain, "AndroidManifest.xml");
    if (fs.existsSync(manifestPath)) {
      items.push(new CategoryItem("manifests", "manifests", module.fsPath, CategoryKind.Manifests));
    }

    const hasJava = fs.existsSync(path.join(srcMain, "java"));
    const hasKotlin = fs.existsSync(path.join(srcMain, "kotlin"));
    if (hasJava || hasKotlin) {
      const label = hasKotlin && hasJava ? "kotlin+java" : hasKotlin ? "kotlin" : "java";
      items.push(new CategoryItem(label, label, module.fsPath, CategoryKind.Sources));
    }

    const resPath = path.join(srcMain, "res");
    if (fs.existsSync(resPath)) {
      items.push(new CategoryItem("res", "res", module.fsPath, CategoryKind.Res));
    }

    const generatedRes = path.join(module.fsPath, "build", "generated", "res");
    if (fs.existsSync(generatedRes)) {
      const cat = new CategoryItem("res (generated)", "res (generated)", module.fsPath, CategoryKind.ResGenerated);
      items.push(cat);
    }

    return items;
  }

  private getCategoryChildren(cat: CategoryItem): ProjectLayoutItem[] {
    const srcMain = path.join(cat.moduleFsPath, "src", "main");

    switch (cat.kind) {
      case CategoryKind.Manifests: {
        const manifestPath = path.join(srcMain, "AndroidManifest.xml");
        return fs.existsSync(manifestPath)
          ? [new FileItem("AndroidManifest.xml", manifestPath)]
          : [];
      }

      case CategoryKind.Sources: {
        const roots = [
          { dir: path.join(srcMain, "java"), suffix: undefined },
          { dir: path.join(srcMain, "kotlin"), suffix: undefined },
          { dir: path.join(cat.moduleFsPath, "src", "androidTest", "java"), suffix: "androidTest" },
          { dir: path.join(cat.moduleFsPath, "src", "androidTest", "kotlin"), suffix: "androidTest" },
          { dir: path.join(cat.moduleFsPath, "src", "test", "java"), suffix: "test" },
          { dir: path.join(cat.moduleFsPath, "src", "test", "kotlin"), suffix: "test" },
        ];

        const items: ProjectLayoutItem[] = [];
        for (const { dir, suffix } of roots) {
          if (!fs.existsSync(dir)) continue;
          const topPackages = getTopPackageRoots(dir);
          for (const pkg of topPackages) {
            items.push(new SourceRootItem(pkg.name, pkg.fsPath, suffix));
          }
        }
        return items;
      }

      case CategoryKind.Res: {
        const resPath = path.join(srcMain, "res");
        return safeReadDir(resPath)
          .filter((e) => fs.statSync(path.join(resPath, e)).isDirectory())
          .sort()
          .map((e) => new ResTypeItem(e, path.join(resPath, e)));
      }

      case CategoryKind.ResGenerated: {
        const generatedRes = path.join(cat.moduleFsPath, "build", "generated", "res");
        return safeReadDir(generatedRes)
          .filter((e) => fs.statSync(path.join(generatedRes, e)).isDirectory())
          .sort()
          .map((e) => new ResTypeItem(e, path.join(generatedRes, e)));
      }
    }
  }

  private getPackageChildren(dir: string, rootDir: string): ProjectLayoutItem[] {
    const entries = safeReadDir(dir);
    return entries
      .sort((a, b) => {
        const aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
        const bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      })
      .map((e) => {
        const full = path.join(dir, e);
        if (fs.statSync(full).isDirectory()) {
          return new PackageItem(e, full, rootDir);
        }
        return new FileItem(e, full);
      });
  }

  private getResTypeChildren(dir: string): ProjectLayoutItem[] {
    return safeReadDir(dir)
      .sort()
      .map((e) => new FileItem(e, path.join(dir, e)));
  }

  private collectGradleScripts(root: string): GradleScriptItem[] {
    const items: GradleScriptItem[] = [];

    const addScript = (filePath: string, label: string, context?: string) => {
      if (fs.existsSync(filePath)) {
        items.push(new GradleScriptItem(label, filePath, context));
      }
    };

    const settingsBase = path.basename(root);
    addScript(path.join(root, "build.gradle.kts"), "build.gradle.kts", `Project: ${settingsBase}`);
    addScript(path.join(root, "build.gradle"), "build.gradle", `Project: ${settingsBase}`);

    const modules = this.detectModules(root);
    for (const m of modules) {
      addScript(path.join(m.fsPath, "build.gradle.kts"), "build.gradle.kts", `Module :${m.name}`);
      addScript(path.join(m.fsPath, "build.gradle"), "build.gradle", `Module :${m.name}`);
      addScript(path.join(m.fsPath, "proguard-rules.pro"), "proguard-rules.pro", `ProGuard Rules for :${m.name}`);
    }

    addScript(path.join(root, "gradle.properties"), "gradle.properties", "Project Properties");
    addScript(
      path.join(root, "gradle", "wrapper", "gradle-wrapper.properties"),
      "gradle-wrapper.properties",
      "Gradle Version"
    );
    addScript(path.join(root, "gradle", "libs.versions.toml"), "libs.versions.toml", 'Version Catalog "libs"');
    addScript(path.join(root, "local.properties"), "local.properties", "SDK Location");
    addScript(path.join(root, "settings.gradle.kts"), "settings.gradle.kts", "Project Settings");
    addScript(path.join(root, "settings.gradle"), "settings.gradle", "Project Settings");

    return items;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function safeReadDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

/**
 * Given a source root like `.../src/main/java`, collapse into the top-level
 * package root (e.g. `com.example.app`) by descending single-child directories.
 */
function getTopPackageRoots(dir: string): { name: string; fsPath: string }[] {
  const entries = safeReadDir(dir).filter((e) =>
    fs.statSync(path.join(dir, e)).isDirectory()
  );

  if (entries.length === 0) return [];

  return entries.map((e) => {
    let current = path.join(dir, e);
    let name = e;
    while (true) {
      const children = safeReadDir(current).filter((c) =>
        fs.statSync(path.join(current, c)).isDirectory()
      );
      const files = safeReadDir(current).filter((c) =>
        !fs.statSync(path.join(current, c)).isDirectory()
      );
      if (children.length === 1 && files.length === 0) {
        name = `${name}.${children[0]}`;
        current = path.join(current, children[0]);
      } else {
        break;
      }
    }
    return { name, fsPath: current };
  });
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
