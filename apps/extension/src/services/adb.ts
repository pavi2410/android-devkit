import * as vscode from "vscode";
import * as path from "node:path";
import {
  type SdkService
} from "./sdk";
import {
  AdbClient,
  resolveAdbPath,
  type Device,
  type ScrcpyServerBinaryStream,
} from "@android-devkit/adb";
import { getOutputChannel } from "../utils/output";

export interface DeviceInfo extends Device {
  name: string;
  apiLevel: number;
  androidVersion: string;
}

export class AdbService {
  private client: AdbClient;
  private _onDevicesChanged = new vscode.EventEmitter<void>();
  readonly outputChannel = getOutputChannel("ADB");

  readonly onDevicesChanged = this._onDevicesChanged.event;

  constructor(private sdkService: SdkService) {
    const adbPath = this.getAdbPath();
    this.client = new AdbClient({ adbPath });
  }

  /**
   * Get ADB path from SDK path or PATH fallback
   */
  private getAdbPath(): string {
    return resolveAdbPath({
      sdkPath: this.getSdkPath(),
    });
  }

  private getSdkPath(): string | undefined {
    return this.sdkService.getSdkPath();
  }

  /**
   * Get list of connected devices with detailed info
   */
  async getDevices(): Promise<DeviceInfo[]> {
    const devices = await this.client.getDevices();
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
          this.client.getDeviceName(device.serial),
          this.client.getApiLevel(device.serial),
          this.client.getAndroidVersion(device.serial),
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

    await this.client.takeScreenshot(serial, localPath);
    return localPath;
  }

  /**
   * Reboot device
   */
  async rebootDevice(
    serial: string,
    mode?: "bootloader" | "recovery" | "sideload"
  ): Promise<void> {
    await this.client.reboot(serial, mode);
    this._onDevicesChanged.fire();
  }

  /**
   * Pair with a device for wireless debugging (Android 11+)
   */
  async pairDevice(host: string, port: number, pairingCode: string): Promise<string> {
    const result = await this.client.pairDevice(host, port, pairingCode);
    this._onDevicesChanged.fire();
    return result;
  }

  /**
   * Discover devices via mDNS
   */
  async listMdnsServices(): Promise<{ name: string; type: string; address: string }[]> {
    return this.client.listMdnsServices();
  }

  /**
   * Check if mDNS is supported
   */
  async isMdnsSupported(): Promise<boolean> {
    return this.client.isMdnsSupported();
  }

  /**
   * Enable TCP/IP mode on a USB-connected device
   */
  async enableTcpip(serial: string, port: number = 5555): Promise<string> {
    return this.client.enableTcpip(serial, port);
  }

  /**
   * List installed packages on a device
   */
  async listPackages(serial: string): Promise<string[]> {
    return this.client.listPackages(serial);
  }

  /**
   * Get PID of a running package
   */
  async getPidForPackage(serial: string, packageName: string): Promise<number | null> {
    return this.client.getPidForPackage(serial, packageName);
  }

  /**
   * List files on device
   */
  async listFiles(serial: string, remotePath: string) {
    return this.client.listFiles(serial, remotePath);
  }

  /**
   * Read file content from device into a Buffer
   */
  async readFileContent(serial: string, remotePath: string): Promise<Buffer> {
    return this.client.readFileContent(serial, remotePath);
  }

  /**
   * Pull file from device
   */
  async pullFile(serial: string, remotePath: string, localPath: string): Promise<void> {
    return this.client.pullFile(serial, remotePath, localPath);
  }

  /**
   * Push file to device
   */
  async pushFile(serial: string, localPath: string, remotePath: string): Promise<void> {
    return this.client.pushFile(serial, localPath, remotePath);
  }

  /**
   * Delete file on device
   */
  async deleteRemoteFile(serial: string, remotePath: string, recursive: boolean = false): Promise<void> {
    return this.client.deleteFile(serial, remotePath, recursive);
  }

  /**
   * Install an APK on a device
   */
  async installApk(serial: string, apkPath: string): Promise<void> {
    return this.client.installApk(serial, apkPath, { replace: true });
  }

  /**
   * Launch an app on a device
   */
  async launchApp(serial: string, packageName: string, activity?: string): Promise<void> {
    return this.client.launchApp(serial, packageName, activity);
  }

  /**
   * Force stop an app on a device
   */
  async forceStopApp(serial: string, packageName: string): Promise<void> {
    return this.client.forceStopApp(serial, packageName);
  }

  async uninstallPackage(serial: string, packageName: string): Promise<void> {
    return this.client.uninstallPackage(serial, packageName);
  }

  async clearAppData(serial: string, packageName: string): Promise<void> {
    return this.client.clearAppData(serial, packageName);
  }

  async launchDeepLink(serial: string, uri: string): Promise<string> {
    return this.client.launchDeepLink(serial, uri);
  }

  async recordScreen(serial: string, duration: number = 10): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `screenrecord-${timestamp}.mp4`;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const dir = workspaceFolder?.uri.fsPath ?? require("os").tmpdir();
    const localPath = path.join(dir, filename);

    await this.client.recordScreen(serial, localPath, duration);
    return localPath;
  }

  async getAppPermissions(serial: string, packageName: string) {
    return this.client.getAppPermissions(serial, packageName);
  }

  async grantPermission(serial: string, packageName: string, permission: string): Promise<void> {
    return this.client.grantPermission(serial, packageName, permission);
  }

  async revokePermission(serial: string, packageName: string, permission: string): Promise<void> {
    return this.client.revokePermission(serial, packageName, permission);
  }

  /**
   * Get the AVD name for a running emulator instance
   */
  async getEmulatorAvdName(serial: string): Promise<string | undefined> {
    return this.client.getEmulatorAvdName(serial);
  }

  /**
   * Get the ADB path (exposed for shell terminal)
   */
  getAdbPathPublic(): string {
    return this.getAdbPath();
  }

  getSdkPathPublic(): string | undefined {
    return this.getSdkPath();
  }

  /**
   * Create a Logcat instance for a device (delegates to AdbClient).
   * Returns a dedicated Logcat instance plus a dispose callback that closes
   * the underlying Adb transport when logcat is done.
   */
  createLogcat(serial: string): ReturnType<AdbClient["createLogcat"]> {
    return this.client.createLogcat(serial);
  }

  /**
   * Push scrcpy server binary to device
   */
  async pushScrcpyServer(serial: string, serverBinary: ScrcpyServerBinaryStream): Promise<void> {
    return this.client.pushScrcpyServer(serial, serverBinary);
  }

  /**
   * Start a scrcpy session for screen mirroring
   */
  async startScrcpy(serial: string, options?: { maxSize?: number; videoBitRate?: number; maxFps?: number }) {
    return this.client.startScrcpy(serial, options);
  }

  /**
   * Evict the cached ADB transport for a device without closing it.
   * Must be called after a scrcpy session closes so subsequent operations
   * get a fresh connection, without breaking any still-running services
   * (Logcat, etc.) that hold a reference to the same transport.
   */
  evictDevice(serial: string): void {
    this.client.evictDevice(serial);
  }

  /**
   * Invalidate the cached ADB transport for a device.
   * Must be called after a scrcpy session closes so subsequent operations
   * (Logcat, shell commands, etc.) get a fresh connection.
   */
  invalidateDevice(serial: string): void {
    this.client.invalidateDevice(serial);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.client.dispose();
    this._onDevicesChanged.dispose();
    this.outputChannel.dispose();
  }
}
