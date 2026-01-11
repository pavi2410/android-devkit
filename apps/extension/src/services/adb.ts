import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  AdbClient,
  getDevices,
  getDeviceName,
  getApiLevel,
  getAndroidVersion,
  takeScreenshot,
  reboot,
  LogcatStream,
  clearLogcat,
  type Device,
  type LogcatEntry,
} from "@android-devkit/adb";

export interface DeviceInfo extends Device {
  name: string;
  apiLevel: number;
  androidVersion: string;
}

export class AdbService {
  private client: AdbClient;
  private logcatStream: LogcatStream | null = null;
  private _onDevicesChanged = new vscode.EventEmitter<void>();
  private _onLogcatEntry = new vscode.EventEmitter<LogcatEntry>();

  readonly onDevicesChanged = this._onDevicesChanged.event;
  readonly onLogcatEntry = this._onLogcatEntry.event;

  constructor() {
    const adbPath = this.getAdbPath();
    this.client = new AdbClient({ adbPath });
  }

  /**
   * Get ADB path from settings or auto-detect
   */
  private getAdbPath(): string {
    const config = vscode.workspace.getConfiguration("androidDevkit");
    const configuredPath = config.get<string>("adbPath");

    if (configuredPath && fs.existsSync(configuredPath)) {
      return configuredPath;
    }

    // Try to find ADB in common locations
    const sdkPath = this.getSdkPath();
    if (sdkPath) {
      const adbInSdk = path.join(sdkPath, "platform-tools", "adb");
      if (fs.existsSync(adbInSdk)) {
        return adbInSdk;
      }
    }

    // Fall back to PATH
    return "adb";
  }

  /**
   * Get Android SDK path
   */
  private getSdkPath(): string | undefined {
    const config = vscode.workspace.getConfiguration("androidDevkit");
    const configuredPath = config.get<string>("sdkPath");

    if (configuredPath && fs.existsSync(configuredPath)) {
      return configuredPath;
    }

    // Check environment variables
    const envPaths = [
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT,
    ];

    for (const envPath of envPaths) {
      if (envPath && fs.existsSync(envPath)) {
        return envPath;
      }
    }

    // Check common locations
    const home = process.env.HOME ?? "";
    const commonPaths = [
      path.join(home, "Android", "Sdk"),
      path.join(home, "Library", "Android", "sdk"),
      "/usr/local/android-sdk",
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return undefined;
  }

  /**
   * Get list of connected devices with detailed info
   */
  async getDevices(): Promise<DeviceInfo[]> {
    const devices = await getDevices(this.client);
    const deviceInfos: DeviceInfo[] = [];

    for (const device of devices) {
      if (device.state !== "device") {
        // Device not ready, include basic info only
        deviceInfos.push({
          ...device,
          name: device.model ?? device.serial,
          apiLevel: 0,
          androidVersion: "Unknown",
        });
        continue;
      }

      try {
        const [name, apiLevel, androidVersion] = await Promise.all([
          getDeviceName(this.client, device.serial),
          getApiLevel(this.client, device.serial),
          getAndroidVersion(this.client, device.serial),
        ]);

        deviceInfos.push({
          ...device,
          name,
          apiLevel,
          androidVersion,
        });
      } catch {
        // If we can't get detailed info, use basic info
        deviceInfos.push({
          ...device,
          name: device.model ?? device.serial,
          apiLevel: 0,
          androidVersion: "Unknown",
        });
      }
    }

    return deviceInfos;
  }

  /**
   * Connect to a device over wireless ADB
   */
  async connectWireless(host: string, port: number = 5555): Promise<string> {
    const result = await this.client.connect(host, port);
    this._onDevicesChanged.fire();
    return result;
  }

  /**
   * Disconnect from a wireless device
   */
  async disconnect(host?: string, port?: number): Promise<string> {
    const result = await this.client.disconnect(host, port);
    this._onDevicesChanged.fire();
    return result;
  }

  /**
   * Take a screenshot from device
   */
  async takeScreenshot(serial: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `screenshot-${timestamp}.png`;

    // Save to workspace if available, otherwise to temp
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const dir = workspaceFolder?.uri.fsPath ?? require("os").tmpdir();
    const localPath = path.join(dir, filename);

    await takeScreenshot(this.client, serial, localPath);
    return localPath;
  }

  /**
   * Reboot device
   */
  async rebootDevice(
    serial: string,
    mode?: "bootloader" | "recovery" | "sideload"
  ): Promise<void> {
    await reboot(this.client, serial, mode);
    this._onDevicesChanged.fire();
  }

  /**
   * Start logcat streaming
   */
  startLogcat(serial?: string, tags?: string[]): void {
    if (this.logcatStream?.isRunning) {
      this.logcatStream.stop();
    }

    this.logcatStream = new LogcatStream({
      adbPath: this.getAdbPath(),
      serial,
      tags,
    });

    this.logcatStream.on("entry", (entry: LogcatEntry) => {
      this._onLogcatEntry.fire(entry);
    });

    this.logcatStream.on("error", (error: Error) => {
      vscode.window.showErrorMessage(`Logcat error: ${error.message}`);
    });

    this.logcatStream.start();
  }

  /**
   * Stop logcat streaming
   */
  stopLogcat(): void {
    this.logcatStream?.stop();
    this.logcatStream = null;
  }

  /**
   * Check if logcat is running
   */
  get isLogcatRunning(): boolean {
    return this.logcatStream?.isRunning ?? false;
  }

  /**
   * Clear device logcat buffer
   */
  async clearLogcat(serial?: string): Promise<void> {
    await clearLogcat(this.getAdbPath(), serial);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopLogcat();
    this._onDevicesChanged.dispose();
    this._onLogcatEntry.dispose();
  }
}
