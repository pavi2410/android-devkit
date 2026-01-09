import * as vscode from "vscode";
import type { AdbService, DeviceInfo } from "../services/adb";

export class DevicesTreeProvider implements vscode.TreeDataProvider<DeviceTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DeviceTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private devices: DeviceInfo[] = [];

  constructor(private adbService: AdbService) {
    // Listen for device changes
    adbService.onDevicesChanged(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DeviceTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DeviceTreeItem): Promise<DeviceTreeItem[]> {
    if (element) {
      // Device properties as children
      return this.getDeviceProperties(element.device);
    }

    // Root level - list devices
    try {
      this.devices = await this.adbService.getDevices();

      if (this.devices.length === 0) {
        return [new NoDevicesItem()];
      }

      return this.devices.map((device) => new DeviceTreeItem(device));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      vscode.window.showErrorMessage(`Failed to list devices: ${message}`);
      return [new ErrorItem(message)];
    }
  }

  private getDeviceProperties(device: DeviceInfo): DeviceTreeItem[] {
    const props: DeviceTreeItem[] = [];

    if (device.state === "device") {
      props.push(
        new PropertyItem("Android", device.androidVersion),
        new PropertyItem("API Level", device.apiLevel.toString()),
        new PropertyItem("Serial", device.serial)
      );

      if (device.product) {
        props.push(new PropertyItem("Product", device.product));
      }
    } else {
      props.push(new PropertyItem("State", device.state));
      props.push(new PropertyItem("Serial", device.serial));
    }

    return props;
  }

  getDevice(serial: string): DeviceInfo | undefined {
    return this.devices.find((d) => d.serial === serial);
  }
}

export class DeviceTreeItem extends vscode.TreeItem {
  constructor(public readonly device: DeviceInfo) {
    super(device.name, vscode.TreeItemCollapsibleState.Collapsed);

    this.contextValue = "device";
    this.id = device.serial;

    // Set icon based on device type and state
    if (device.state !== "device") {
      this.iconPath = new vscode.ThemeIcon("warning");
      this.description = device.state;
    } else if (device.isEmulator) {
      this.iconPath = new vscode.ThemeIcon("vm");
      this.description = `Android ${device.androidVersion}`;
    } else {
      this.iconPath = new vscode.ThemeIcon("device-mobile");
      this.description = `Android ${device.androidVersion}`;
    }

    this.tooltip = this.createTooltip();
  }

  private createTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.device.name}**\n\n`);
    md.appendMarkdown(`- Serial: \`${this.device.serial}\`\n`);
    md.appendMarkdown(`- State: ${this.device.state}\n`);

    if (this.device.state === "device") {
      md.appendMarkdown(`- Android: ${this.device.androidVersion}\n`);
      md.appendMarkdown(`- API Level: ${this.device.apiLevel}\n`);
    }

    if (this.device.isEmulator) {
      md.appendMarkdown(`- Type: Emulator\n`);
    } else {
      md.appendMarkdown(`- Type: Physical Device\n`);
    }

    return md;
  }
}

class PropertyItem extends vscode.TreeItem {
  constructor(label: string, value: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = value;
    this.iconPath = new vscode.ThemeIcon("symbol-property");
  }
}

class NoDevicesItem extends vscode.TreeItem {
  constructor() {
    super("No devices connected", vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("info");
    this.tooltip = "Connect a device via USB or start an emulator";
  }
}

class ErrorItem extends vscode.TreeItem {
  constructor(message: string) {
    super("Error", vscode.TreeItemCollapsibleState.None);
    this.description = message;
    this.iconPath = new vscode.ThemeIcon("error");
  }
}
