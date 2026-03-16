import * as vscode from "vscode";
import type { AdbService } from "../services/adb";
import { ANDROID_DEVKIT_COMMANDS, CONTEXT_KEYS } from "../commands/ids";
import { setAndroidDevkitContext } from "../config/context";

type FileEntry = {
  name: string;
  type: "file" | "directory" | "link" | "other";
  size: number;
  permissions: string;
  modifiedDate: string;
  linkTarget?: string;
  linkTargetType?: "file" | "directory";
};

type FileExplorerItem = FileTreeItem | MessageItem;

export class FileExplorerProvider implements vscode.TreeDataProvider<FileExplorerItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<FileExplorerItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private currentDevice?: string;

  constructor(private adbService: AdbService) {
    void setAndroidDevkitContext(CONTEXT_KEYS.fileExplorerHasDevice, false);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setDevice(serial: string): void {
    this.currentDevice = serial;
    void setAndroidDevkitContext(CONTEXT_KEYS.fileExplorerHasDevice, true);
    this.refresh();
  }

  clearDevice(): void {
    this.currentDevice = undefined;
    void setAndroidDevkitContext(CONTEXT_KEYS.fileExplorerHasDevice, false);
    this.refresh();
  }

  getCurrentDevice(): string | undefined {
    return this.currentDevice;
  }

  getTreeItem(element: FileExplorerItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: FileExplorerItem): Promise<FileExplorerItem[]> {
    if (!this.currentDevice) {
      return [];
    }

    // MessageItem has no children
    if (element instanceof MessageItem) return [];

    const remotePath = (element as FileTreeItem)?.remotePath ?? "/";

    try {
      const files = await this.adbService.listFiles(this.currentDevice, remotePath);

      if (files.length === 0) {
        return [];
      }

      const isExpandable = (f: FileEntry) =>
        f.type === "directory" || (f.type === "link" && f.linkTargetType !== "file");
      return files
        .sort((a: FileEntry, b: FileEntry) => {
          // Expandable entries first, then alphabetical
          const aExp = isExpandable(a);
          const bExp = isExpandable(b);
          if (aExp && !bExp) return -1;
          if (!aExp && bExp) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((f: FileEntry) => new FileTreeItem(f, remotePath, this.currentDevice!));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return [new MessageItem(`Error: ${message}`)];
    }
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

export class FileTreeItem extends vscode.TreeItem {
  public readonly remotePath: string;

  constructor(
    public readonly file: FileEntry,
    parentPath: string,
    public readonly deviceSerial: string
  ) {
    const isLinkToDir = file.type === "link" && file.linkTargetType !== "file";
    const isExpandable = file.type === "directory" || isLinkToDir;
    super(
      file.name,
      isExpandable ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    this.remotePath = parentPath === "/" ? `/${file.name}` : `${parentPath}/${file.name}`;

    if (file.type === "directory") {
      this.iconPath = new vscode.ThemeIcon("folder");
      this.contextValue = "directory";
    } else if (file.type === "link" && isLinkToDir) {
      this.iconPath = new vscode.ThemeIcon("file-symlink-directory");
      this.contextValue = "directory";
    } else if (file.type === "link") {
      this.iconPath = new vscode.ThemeIcon("file-symlink-file");
      this.contextValue = "file";
      this.command = {
        command: ANDROID_DEVKIT_COMMANDS.openDeviceFile,
        title: "Open File",
        arguments: [this],
      };
    } else {
      this.iconPath = vscode.ThemeIcon.File;
      this.contextValue = "file";
      this.command = {
        command: ANDROID_DEVKIT_COMMANDS.openDeviceFile,
        title: "Open File",
        arguments: [this],
      };
    }

    if (file.linkTarget) {
      this.description = `→ ${file.linkTarget}`;
    }

    this.tooltip = this.createTooltip();
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  private createTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.file.name}**\n\n`);
    md.appendMarkdown(`- Path: \`${this.remotePath}\`\n`);
    md.appendMarkdown(`- Size: ${this.formatSize(this.file.size)}\n`);
    md.appendMarkdown(`- Permissions: \`${this.file.permissions}\`\n`);
    md.appendMarkdown(`- Modified: ${this.file.modifiedDate}\n`);
    if (this.file.linkTarget) {
      md.appendMarkdown(`- Target: \`${this.file.linkTarget}\`\n`);
    }
    return md;
  }
}

class MessageItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("info");
  }
}
