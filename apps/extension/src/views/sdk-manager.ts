import * as vscode from "vscode";
import type { SdkService, SdkPackage } from "../services/sdk";

type SdkManagerTreeItem = CategoryItem | PackageItem | NoSdkItem | ErrorItem;

export class SdkManagerProvider implements vscode.TreeDataProvider<SdkManagerTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SdkManagerTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private packages: SdkPackage[] = [];

  constructor(private sdkService: SdkService) {
    sdkService.onSdkPackagesChanged(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SdkManagerTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SdkManagerTreeItem): Promise<SdkManagerTreeItem[]> {
    if (!this.sdkService.getSdkPath()) {
      return [new NoSdkItem()];
    }

    if (element instanceof CategoryItem) {
      return this.packages
        .filter((p) => p.category === element.category)
        .sort((a, b) => compareVersionsDesc(a.id, a.version, b.id, b.version))
        .map((p) => new PackageItem(p));
    }

    if (element) return [];

    try {
      this.packages = await this.sdkService.listSdkPackages();

      const categories = [
        "platforms",
        "build-tools",
        "platform-tools",
        "cmdline-tools",
        "system-images",
        "extras",
        "other",
      ] as const;

      const usedCategories = categories.filter((cat) =>
        this.packages.some((p) => p.category === cat)
      );

      return usedCategories.map((cat) => {
        const pkgs = this.packages.filter((p) => p.category === cat);
        const installedCount = pkgs.filter((p) => p.installed).length;
        return new CategoryItem(cat, pkgs.length, installedCount);
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return [new ErrorItem(msg)];
    }
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  "platforms": "Platforms",
  "build-tools": "Build Tools",
  "platform-tools": "Platform Tools",
  "cmdline-tools": "Command-line Tools",
  "system-images": "System Images",
  "extras": "Extras",
  "other": "Other",
};

class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly category: string,
    total: number,
    installed: number
  ) {
    super(CATEGORY_LABELS[category] ?? category, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `${installed}/${total} installed`;
    this.iconPath = new vscode.ThemeIcon(installed > 0 ? "package" : "circle-outline");
  }
}

export class PackageItem extends vscode.TreeItem {
  constructor(public readonly pkg: SdkPackage) {
    super(pkg.displayName, vscode.TreeItemCollapsibleState.None);
    this.description = pkg.version;
    this.contextValue = pkg.installed ? "sdkPackage.installed" : "sdkPackage.available";
    this.iconPath = new vscode.ThemeIcon(
      pkg.installed ? "check" : "cloud-download"
    );
    this.tooltip = new vscode.MarkdownString(
      `**${pkg.displayName}**\n\n- ID: \`${pkg.id}\`\n- Version: ${pkg.version}\n- Status: ${pkg.installed ? "Installed" : "Available"}`
    );
  }
}

class NoSdkItem extends vscode.TreeItem {
  constructor() {
    super("Android SDK not configured", vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("warning");
    this.tooltip = "Configure androidDevkit.sdkPath or set ANDROID_HOME";
    this.command = {
      command: "androidDevkit.openWelcome",
      title: "Open Setup",
    };
  }
}

class ErrorItem extends vscode.TreeItem {
  constructor(message: string) {
    super("Error loading packages", vscode.TreeItemCollapsibleState.None);
    this.description = message;
    this.iconPath = new vscode.ThemeIcon("error");
  }
}

/**
 * Sort SDK packages descending (newer first).
 * Extracts numeric API level from id (e.g. "platforms;android-36") for proper numeric sort,
 * falling back to semver-style version comparison.
 */
function compareVersionsDesc(idA: string, verA: string, idB: string, verB: string): number {
  // Try to extract API level from package id for platforms/system-images/sources
  const apiA = extractApiLevel(idA);
  const apiB = extractApiLevel(idB);
  if (apiA !== null && apiB !== null && apiA !== apiB) {
    return apiB - apiA;
  }

  // Fall back to version string comparison (numeric parts)
  const partsA = verA.split(".").map(Number);
  const partsB = verB.split(".").map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const a = partsA[i] ?? 0;
    const b = partsB[i] ?? 0;
    if (b !== a) return b - a;
  }
  return 0;
}

function extractApiLevel(id: string): number | null {
  const match = id.match(/android-(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1]);
}
