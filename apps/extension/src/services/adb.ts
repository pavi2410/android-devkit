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
  pairDevice,
  listMdnsServices,
  isMdnsSupported,
  enableTcpip,
  listPackages,
  getPidForPackage,
  listFiles,
  pullFile,
  pushFile,
  deleteFile,
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
   *
   * Detection order:
   * 1. Extension setting `androidDevkit.sdkPath`
   * 2. ANDROID_HOME (current recommended env var)
   * 3. ANDROID_SDK_ROOT (deprecated since cmdline-tools 7.0, still checked as fallback)
   * 4. Platform-specific default install locations (Android Studio defaults)
   */
  private getSdkPath(): string | undefined {
    const config = vscode.workspace.getConfiguration("androidDevkit");
    const configuredPath = config.get<string>("sdkPath");

    if (configuredPath && fs.existsSync(configuredPath)) {
      return configuredPath;
    }

    // ANDROID_HOME is the current standard (cmdline-tools 7.0+)
    // ANDROID_SDK_ROOT is deprecated but widely used
    const envPaths = [
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT,
    ];

    for (const envPath of envPaths) {
      if (envPath && fs.existsSync(envPath)) {
        return envPath;
      }
    }

    // Platform-specific default install locations
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    const localAppData = process.env.LOCALAPPDATA ?? "";
    const commonPaths = [
      // macOS (Android Studio default)
      path.join(home, "Library", "Android", "sdk"),
      // Linux (Android Studio default)
      path.join(home, "Android", "Sdk"),
      // Windows (Android Studio default)
      path.join(localAppData, "Android", "Sdk"),
      // Homebrew on macOS
      "/opt/homebrew/share/android-commandlinetools",
      // System-wide installs
      "/usr/local/android-sdk",
      "/opt/android-sdk",
    ];

    for (const p of commonPaths) {
      if (p && fs.existsSync(p)) {
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
   * Pair with a device for wireless debugging (Android 11+)
   */
  async pairDevice(host: string, port: number, pairingCode: string): Promise<string> {
    const result = await pairDevice(this.client, host, port, pairingCode);
    this._onDevicesChanged.fire();
    return result;
  }

  /**
   * Discover devices via mDNS
   */
  async listMdnsServices(): Promise<{ name: string; type: string; address: string }[]> {
    return listMdnsServices(this.client);
  }

  /**
   * Check if mDNS is supported
   */
  async isMdnsSupported(): Promise<boolean> {
    return isMdnsSupported(this.client);
  }

  /**
   * Enable TCP/IP mode on a USB-connected device
   */
  async enableTcpip(serial: string, port: number = 5555): Promise<string> {
    return enableTcpip(this.client, serial, port);
  }

  /**
   * List installed packages on a device
   */
  async listPackages(serial: string): Promise<string[]> {
    return listPackages(this.client, serial);
  }

  /**
   * Get PID of a running package
   */
  async getPidForPackage(serial: string, packageName: string): Promise<number | null> {
    return getPidForPackage(this.client, serial, packageName);
  }

  /**
   * List files on device
   */
  async listFiles(serial: string, remotePath: string) {
    return listFiles(this.client, serial, remotePath);
  }

  /**
   * Pull file from device
   */
  async pullFile(serial: string, remotePath: string, localPath: string): Promise<void> {
    return pullFile(this.client, serial, remotePath, localPath);
  }

  /**
   * Push file to device
   */
  async pushFile(serial: string, localPath: string, remotePath: string): Promise<void> {
    return pushFile(this.client, serial, localPath, remotePath);
  }

  /**
   * Delete file on device
   */
  async deleteRemoteFile(serial: string, remotePath: string, recursive: boolean = false): Promise<void> {
    return deleteFile(this.client, serial, remotePath, recursive);
  }

  /**
   * Get the ADB path (exposed for shell terminal)
   */
  getAdbPathPublic(): string {
    return this.getAdbPath();
  }

  /**
   * Get the detected SDK path (exposed for settings)
   */
  getSdkPathPublic(): string | undefined {
    return this.getSdkPath();
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
