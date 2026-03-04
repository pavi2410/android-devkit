import * as vscode from "vscode";
import type { GradleService, BuildVariant } from "../services/gradle";
import type { AdbService } from "../services/adb";

type BuildRunTreeItem = SectionItem | ActionItem;

export class BuildRunProvider implements vscode.TreeDataProvider<BuildRunTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BuildRunTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private selectedVariant: BuildVariant | undefined;
  private selectedDeviceSerial: string | undefined;
  private selectedDeviceLabel: string | undefined;
  private variants: BuildVariant[] = [];

  constructor(
    private gradleService: GradleService,
    readonly adbService: AdbService,
    private context: vscode.ExtensionContext
  ) {
    this.selectedVariant = context.workspaceState.get<BuildVariant>("buildRun.variant");
    this.selectedDeviceSerial = context.workspaceState.get<string>("buildRun.deviceSerial");
    this.selectedDeviceLabel = context.workspaceState.get<string>("buildRun.deviceLabel");
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getSelectedVariant(): BuildVariant | undefined {
    return this.selectedVariant;
  }

  getSelectedDeviceSerial(): string | undefined {
    return this.selectedDeviceSerial;
  }

  async setVariant(variant: BuildVariant): Promise<void> {
    this.selectedVariant = variant;
    await this.context.workspaceState.update("buildRun.variant", variant);
    this.refresh();
  }

  async setDevice(serial: string, label: string): Promise<void> {
    this.selectedDeviceSerial = serial;
    this.selectedDeviceLabel = label;
    await this.context.workspaceState.update("buildRun.deviceSerial", serial);
    await this.context.workspaceState.update("buildRun.deviceLabel", label);
    this.refresh();
  }

  getTreeItem(element: BuildRunTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BuildRunTreeItem): Promise<BuildRunTreeItem[]> {
    if (element) return [];

    if (this.variants.length === 0) {
      try {
        this.variants = await this.gradleService.getBuildVariants();
        if (this.variants.length > 0 && !this.selectedVariant) {
          const debugVariant = this.variants.find((v) => v.name.toLowerCase() === "debug") ?? this.variants[0];
          await this.setVariant(debugVariant);
        }
      } catch {
        this.variants = [];
      }
    }

    const variantLabel = this.selectedVariant?.name ?? "Not selected";
    const deviceLabel = this.selectedDeviceLabel ?? "Not selected";

    return [
      new SectionItem("Build Variant", variantLabel, "$(symbol-enum)", "androidDevkit.selectBuildVariant"),
      new SectionItem("Target Device", deviceLabel, "$(device-mobile)", "androidDevkit.selectRunTarget"),
      new ActionItem("Build", "Assemble selected variant", "$(package)", "androidDevkit.buildVariant"),
      new ActionItem("Run", "Build, install and launch app", "$(play)", "androidDevkit.runOnDevice"),
      new ActionItem("Stop", "Force-stop app on target device", "$(debug-stop)", "androidDevkit.stopApp"),
      new ActionItem("Install APK", "Install APK from file", "$(cloud-download)", "androidDevkit.installApk"),
    ];
  }

  getVariants(): BuildVariant[] {
    return this.variants;
  }
}

class SectionItem extends vscode.TreeItem {
  constructor(
    label: string,
    value: string,
    iconId: string,
    commandId: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = value;
    this.iconPath = new vscode.ThemeIcon(iconId.replace(/^\$\(/, "").replace(/\)$/, ""));
    this.command = { command: commandId, title: label };
    this.contextValue = "buildRunSection";
  }
}

class ActionItem extends vscode.TreeItem {
  constructor(
    label: string,
    tooltip: string,
    iconId: string,
    commandId: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tooltip;
    this.iconPath = new vscode.ThemeIcon(iconId.replace(/^\$\(/, "").replace(/\)$/, ""));
    this.command = { command: commandId, title: label };
    this.contextValue = "buildRunAction";
  }
}
