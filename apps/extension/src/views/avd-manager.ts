import * as vscode from "vscode";
import type { SdkService, Avd, AvdServices } from "../services/sdk";
import type { AdbService } from "../services/adb";
import { CONTEXT_KEYS, VS_CODE_COMMANDS } from "../commands/ids";

type AvdManagerTreeItem = AvdItem | PropertyItem | ErrorItem;

function getAvdServicesLabel(services: AvdServices | undefined): string {
  switch (services) {
    case "google-play-store":
      return "Google Play Store";
    case "google-apis":
      return "Google APIs";
    case "aosp":
    default:
      return "AOSP";
  }
}

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
    void vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, CONTEXT_KEYS.hasAvds, false);
    void vscode.commands.executeCommand(
      VS_CODE_COMMANDS.setContext,
      CONTEXT_KEYS.sdkConfigured,
      Boolean(this.sdkService.getSdkPath())
    );
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
    if (element instanceof AvdItem) {
      return this.getAvdProperties(element.avd, element.running);
    }

    if (element) return [];

    const sdkConfigured = Boolean(this.sdkService.getSdkPath());
    void vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, CONTEXT_KEYS.sdkConfigured, sdkConfigured);

    if (!sdkConfigured) {
      void vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, CONTEXT_KEYS.hasAvds, false);
      return [];
    }

    try {
      this.avds = await this.sdkService.listAvds();
      void vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, CONTEXT_KEYS.hasAvds, this.avds.length > 0);

      if (this.avds.length === 0) {
        return [];
      }

      return this.avds.map((avd) => {
        const running = this.runningSerials.length > 0 && avd.abi.includes("x86");
        return new AvdItem(avd, running);
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      void vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, CONTEXT_KEYS.hasAvds, false);
      return [new ErrorItem(msg)];
    }
  }

  private getAvdProperties(avd: Avd, running: boolean): PropertyItem[] {
    const props: PropertyItem[] = [new PropertyItem("Status", running ? "Running" : "Stopped")];
    const config = avd.config;
    const services = getAvdServicesLabel(config?.services);

    if (avd.api > 0) {
      props.push(new PropertyItem("API Level", avd.api.toString()));
    }

    props.push(new PropertyItem("Services", services));

    if (avd.target) {
      props.push(new PropertyItem("Target", avd.target));
    }

    if (avd.abi) {
      props.push(new PropertyItem("ABI", avd.abi));
    }

    if (avd.device) {
      props.push(new PropertyItem("Device", avd.device));
    }

    if (config?.lcdWidth && config.lcdHeight) {
      props.push(
        new PropertyItem(
          "Resolution",
          `${config.lcdWidth}×${config.lcdHeight} (${config.lcdDensity ?? "?"}dpi)`
        )
      );
    }

    if (config?.ram) {
      props.push(new PropertyItem("RAM", `${config.ram}MB`));
    }

    if (config?.cpuArch) {
      props.push(
        new PropertyItem(
          "CPU",
          `${config.cpuArch}${config.cpuCores ? ` (${config.cpuCores} cores)` : ""}`
        )
      );
    }

    if (config?.gpuMode) {
      props.push(
        new PropertyItem(
          "GPU",
          `${config.gpuMode}${config.gpuEnabled ? "" : " (disabled)"}`
        )
      );
    }

    const sdcard = config?.sdcard ?? avd.sdcard;
    if (sdcard) {
      props.push(new PropertyItem("SD Card", sdcard));
    }

    if (config?.skin) {
      props.push(new PropertyItem("Skin", config.skin));
    }

    props.push(new PropertyItem("Path", avd.path));

    return props;
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
    super(displayName, vscode.TreeItemCollapsibleState.Collapsed);

    this.id = avd.name;
    const services = getAvdServicesLabel(avd.config?.services);

    const parts: string[] = [];
    if (avd.api > 0) parts.push(`API ${avd.api}`);
    parts.push(services);
    this.description = parts.join(" · ");

    this.contextValue = running ? "avd.running" : "avd.stopped";
    this.iconPath = new vscode.ThemeIcon(running ? "vm-running" : "vm");
    this.tooltip = [displayName, running ? "Running" : "Stopped", parts.join(" · ")]
      .filter(Boolean)
      .join(" — ");
  }
}

class PropertyItem extends vscode.TreeItem {
  constructor(label: string, value: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = value;
    this.iconPath = new vscode.ThemeIcon("symbol-property");
  }
}

class ErrorItem extends vscode.TreeItem {
  constructor(message: string) {
    super("Error loading AVDs", vscode.TreeItemCollapsibleState.None);
    this.description = message;
    this.iconPath = new vscode.ThemeIcon("error");
  }
}
