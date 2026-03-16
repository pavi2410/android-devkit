import * as vscode from "vscode";
import type { GradleService, BuildVariant } from "../services/gradle";
import type { AdbService } from "../services/adb";
import { ANDROID_DEVKIT_COMMANDS, type AndroidDevkitCommandId } from "../commands/ids";

type BuildRunTreeItem = SectionItem | ActionItem;

export class BuildRunProvider implements vscode.TreeDataProvider<BuildRunTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BuildRunTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private _onDidSelectionChange = new vscode.EventEmitter<void>();
  readonly onDidSelectionChange = this._onDidSelectionChange.event;

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

  getSelectedDeviceLabel(): string | undefined {
    return this.selectedDeviceLabel;
  }

  async ensureInitialized(): Promise<void> {
    if (this.variants.length > 0) {
      return;
    }

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

  async setVariant(variant: BuildVariant): Promise<void> {
    this.selectedVariant = variant;
    await this.context.workspaceState.update("buildRun.variant", variant);
    this._onDidSelectionChange.fire();
    this.refresh();
  }

  async setDevice(serial: string, label: string): Promise<void> {
    this.selectedDeviceSerial = serial;
    this.selectedDeviceLabel = label;
    await this.context.workspaceState.update("buildRun.deviceSerial", serial);
    await this.context.workspaceState.update("buildRun.deviceLabel", label);
    this._onDidSelectionChange.fire();
    this.refresh();
  }

  getTreeItem(element: BuildRunTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BuildRunTreeItem): Promise<BuildRunTreeItem[]> {
    if (element) return [];

    await this.ensureInitialized();

    const variantLabel = this.selectedVariant
      ? `${this.selectedVariant.name} (:${this.selectedVariant.module})`
      : "Not selected";
    const deviceLabel = this.selectedDeviceLabel ?? "Not selected";

    return [
      new SectionItem("Build Variant", variantLabel, "$(symbol-enum)", ANDROID_DEVKIT_COMMANDS.selectBuildVariant),
      new SectionItem("Target Device", deviceLabel, "$(device-mobile)", ANDROID_DEVKIT_COMMANDS.selectRunTarget),
      new ActionItem("Build", "Assemble selected variant", "$(package)", ANDROID_DEVKIT_COMMANDS.buildVariant),
      new ActionItem("Run", "Build, install and launch app", "$(play)", ANDROID_DEVKIT_COMMANDS.runOnDevice),
      new ActionItem("Stop", "Force-stop app on target device", "$(debug-stop)", ANDROID_DEVKIT_COMMANDS.stopApp),
      new ActionItem("Install APK", "Install APK from file", "$(cloud-download)", ANDROID_DEVKIT_COMMANDS.installApk),
    ];
  }

  getVariants(): BuildVariant[] {
    return this.variants;
  }

  dispose(): void {
    this._onDidSelectionChange.dispose();
    this._onDidChangeTreeData.dispose();
  }
}

class SectionItem extends vscode.TreeItem {
  constructor(
    label: string,
    value: string,
    iconId: string,
    commandId: AndroidDevkitCommandId
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
    commandId: AndroidDevkitCommandId
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tooltip;
    this.iconPath = new vscode.ThemeIcon(iconId.replace(/^\$\(/, "").replace(/\)$/, ""));
    this.command = { command: commandId, title: label };
    this.contextValue = "buildRunAction";
  }
}
