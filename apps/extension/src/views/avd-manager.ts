import * as vscode from "vscode";
import type { SdkService, Avd } from "../services/sdk";
import type { AdbService } from "../services/adb";
import { ANDROID_DEVKIT_COMMANDS } from "../commands/ids";

type AvdManagerTreeItem = AvdItem | NoSdkItem | NoAvdsItem | ErrorItem;

export class AvdManagerProvider implements vscode.TreeDataProvider<AvdManagerTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AvdManagerTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private avds: Avd[] = [];
  private runningSerials: string[] = [];
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private sdkService: SdkService,
    private adbService: AdbService
  ) {
    sdkService.onAvdsChanged(() => this.refresh());
    adbService.onDevicesChanged(() => this.refreshRunningState());
    this.startPolling();
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => this.refreshRunningState(), 5000);
  }

  private async refreshRunningState(): Promise<void> {
    try {
      const devices = await this.adbService.getDevices();
      this.runningSerials = devices
        .filter((d) => d.serial.startsWith("emulator-"))
        .map((d) => d.serial);
      this._onDidChangeTreeData.fire();
    } catch {
      // ignore poll errors
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AvdManagerTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AvdManagerTreeItem): Promise<AvdManagerTreeItem[]> {
    if (element) return [];

    if (!this.sdkService.getSdkPath()) {
      return [new NoSdkItem()];
    }

    try {
      this.avds = await this.sdkService.listAvds();

      if (this.avds.length === 0) {
        return [new NoAvdsItem()];
      }

      return this.avds.map((avd) => {
        const running = this.runningSerials.length > 0 && avd.abi.includes("x86");
        return new AvdItem(avd, running);
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return [new ErrorItem(msg)];
    }
  }

  getAvd(name: string): Avd | undefined {
    return this.avds.find((a) => a.name === name);
  }

  dispose(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }
}

export class AvdItem extends vscode.TreeItem {
  constructor(
    public readonly avd: Avd,
    public readonly running: boolean
  ) {
    const displayName = avd.config?.displayName ?? avd.name.replace(/_/g, " ");
    super(displayName, vscode.TreeItemCollapsibleState.None);

    this.id = avd.name;

    const parts: string[] = [];
    if (avd.api > 0) parts.push(`API ${avd.api}`);
    if (avd.abi) parts.push(avd.abi);
    this.description = parts.join(" · ");

    this.contextValue = running ? "avd.running" : "avd.stopped";
    this.iconPath = new vscode.ThemeIcon(running ? "vm-running" : "vm");

    const config = avd.config;
    const lines: string[] = [`**${displayName}**`, ""];
    lines.push(`- Status: ${running ? "🟢 Running" : "⬜ Stopped"}`);
    if (avd.api > 0) lines.push(`- API Level: ${avd.api}`);
    if (avd.target) lines.push(`- Target: ${avd.target}`);
    if (avd.abi) lines.push(`- ABI: ${avd.abi}`);
    if (avd.device) lines.push(`- Device: ${avd.device}`);
    if (config) {
      if (config.lcdWidth && config.lcdHeight) {
        lines.push(`- Resolution: ${config.lcdWidth}×${config.lcdHeight} (${config.lcdDensity ?? "?"}dpi)`);
      }
      if (config.ram) lines.push(`- RAM: ${config.ram}MB`);
      if (config.cpuArch) lines.push(`- CPU: ${config.cpuArch}${config.cpuCores ? ` (${config.cpuCores} cores)` : ""}`);
      if (config.gpuMode) lines.push(`- GPU: ${config.gpuMode}${config.gpuEnabled ? "" : " (disabled)"}`);
      if (config.playStoreEnabled) lines.push(`- Play Store: Yes`);
      if (config.sdcard) lines.push(`- SD Card: ${config.sdcard}`);
    }
    lines.push(`- Path: \`${avd.path}\``);

    this.tooltip = new vscode.MarkdownString(lines.join("\n"));
  }
}

class NoSdkItem extends vscode.TreeItem {
  constructor() {
    super("Android SDK not configured", vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("warning");
    this.tooltip = "Configure androidDevkit.sdkPath or set ANDROID_HOME";
    this.command = { command: ANDROID_DEVKIT_COMMANDS.showSdkInfo, title: "Open Setup" };
  }
}

class NoAvdsItem extends vscode.TreeItem {
  constructor() {
    super("No virtual devices", vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("info");
    this.tooltip = "Create a new AVD to get started";
    this.command = { command: ANDROID_DEVKIT_COMMANDS.createAvd, title: "Create AVD" };
  }
}

class ErrorItem extends vscode.TreeItem {
  constructor(message: string) {
    super("Error loading AVDs", vscode.TreeItemCollapsibleState.None);
    this.description = message;
    this.iconPath = new vscode.ThemeIcon("error");
  }
}
