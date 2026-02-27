import * as vscode from "vscode";
import type { AdbService } from "../services/adb";

type FileEntry = {
  name: string;
  type: "file" | "directory" | "link" | "other";
  size: number;
  permissions: string;
  modifiedDate: string;
};

type FileExplorerItem = FileTreeItem | MessageItem;

export class FileExplorerProvider implements vscode.TreeDataProvider<FileExplorerItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<FileExplorerItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private currentDevice?: string;

  constructor(private adbService: AdbService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setDevice(serial: string): void {
    this.currentDevice = serial;
    this.refresh();
  }

  getTreeItem(element: FileExplorerItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: FileExplorerItem): Promise<FileExplorerItem[]> {
    if (!this.currentDevice) {
      return [new MessageItem("Select a device to browse files")];
    }

    // MessageItem has no children
    if (element instanceof MessageItem) return [];

    const remotePath = (element as FileTreeItem)?.remotePath ?? "/";

    try {
      const files = await this.adbService.listFiles(this.currentDevice, remotePath);

      if (files.length === 0) {
        return [new MessageItem("Empty directory")];
      }

      return files
        .sort((a: FileEntry, b: FileEntry) => {
          // Directories first, then alphabetical
          if (a.type === "directory" && b.type !== "directory") return -1;
          if (a.type !== "directory" && b.type === "directory") return 1;
          return a.name.localeCompare(b.name);
        })
        .map((f: FileEntry) => new FileTreeItem(f, remotePath, this.currentDevice!));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return [new MessageItem(`Error: ${message}`)];
    }
  }
}

export class FileTreeItem extends vscode.TreeItem {
  public readonly remotePath: string;

  constructor(
    public readonly file: FileEntry,
    parentPath: string,
    public readonly deviceSerial: string
  ) {
    const isDir = file.type === "directory";
    super(
      file.name,
      isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    this.remotePath = parentPath === "/" ? `/${file.name}` : `${parentPath}/${file.name}`;

    if (isDir) {
      this.iconPath = new vscode.ThemeIcon("folder");
      this.contextValue = "directory";
    } else if (file.type === "link") {
      this.iconPath = new vscode.ThemeIcon("file-symlink-file");
      this.contextValue = "file";
    } else {
      this.iconPath = vscode.ThemeIcon.File;
      this.contextValue = "file";
    }

    this.description = this.formatSize(file.size);
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
    return md;
  }
}

class MessageItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("info");
  }
}
