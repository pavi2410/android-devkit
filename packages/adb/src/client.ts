import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { Readable } from "node:stream";
import { AdbServerClient, LinuxFileType, type Adb } from "@yume-chan/adb";
import { AdbServerNodeTcpConnector } from "@yume-chan/adb-server-node-tcp";
import { Logcat, PackageManager } from "@yume-chan/android-bin";
import type { ReadableStream } from "@yume-chan/stream-extra";
import { resolvePlatformToolPath } from "@android-devkit/android-sdk";
import type {
  AdbClientOptions,
  ConnectionType,
  Device,
  DeviceState,
  ResolveAdbPathOptions,
} from "./types.js";

/**
 * Collect a ReadableStream<Uint8Array> into a string.
 */
async function collectText(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return result;
}

/**
 * Detect how a device is connected based on its serial format.
 */
function detectConnectionType(serial: string): ConnectionType {
  if (serial.startsWith("emulator-")) {
    return "emulator";
  }

  const ipPortMatch = serial.match(
    /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/,
  );
  if (ipPortMatch) {
    const port = parseInt(ipPortMatch[2], 10);
    if (port === 5555) {
      return "tcpip";
    }
    return "wireless";
  }

  if (serial.startsWith("adb-")) {
    return "wireless";
  }

  return "usb";
}

/** Escape a value for use inside single quotes in an Android shell command. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Format a LinuxFileType + permission bits into a standard `ls -la` style
 * permissions string (e.g., "drwxr-xr-x").
 */
function formatPermissions(fileType: number, perm: number): string {
  const typeChar =
    fileType === LinuxFileType.Directory
      ? "d"
      : fileType === LinuxFileType.Link
        ? "l"
        : "-";

  const bits = [
    perm & 0o400 ? "r" : "-",
    perm & 0o200 ? "w" : "-",
    perm & 0o100 ? "x" : "-",
    perm & 0o040 ? "r" : "-",
    perm & 0o020 ? "w" : "-",
    perm & 0o010 ? "x" : "-",
    perm & 0o004 ? "r" : "-",
    perm & 0o002 ? "w" : "-",
    perm & 0o001 ? "x" : "-",
  ];

  return typeChar + bits.join("");
}

/**
 * Format a Date as "YYYY-MM-DD HH:MM" to match our existing interface.
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

/**
 * Map ADB server connection state to our DeviceState type.
 */
function mapServerState(state: string): DeviceState {
  switch (state) {
    case "device":
      return "device";
    case "offline":
      return "offline";
    case "unauthorized":
      return "unauthorized";
    case "authorizing":
      return "authorizing";
    case "bootloader":
      return "bootloader";
    case "recovery":
      return "recovery";
    case "sideload":
      return "sideload";
    default:
      return "unknown";
  }
}

/**
 * Resolve the path to the ADB binary.
 */
export function resolveAdbPath(options: ResolveAdbPathOptions = {}): string {
  const configuredPath = options.adbPath?.trim();
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  if (options.sdkPath) {
    const adbInSdk = resolvePlatformToolPath(options.sdkPath, "adb");
    if (adbInSdk) {
      return adbInSdk;
    }
  }

  return "adb";
}

/**
 * ADB client backed by the Tango protocol library (@yume-chan/adb).
 *
 * Uses AdbServerClient for server-level operations and creates per-device
 * Adb instances for device-level operations via the subprocess and sync APIs.
 * Falls back to spawning the ADB CLI binary for operations not directly
 * supported by the protocol (connect, disconnect, pair, mDNS, etc.).
 */
export class AdbClient {
  private serverClient: AdbServerClient;
  private adbPath: string;
  private deviceConnections = new Map<string, Adb>();

  constructor(options: AdbClientOptions = {}) {
    this.adbPath = resolveAdbPath({
      adbPath: options.adbPath,
      sdkPath: options.sdkPath,
    });
    const connector = new AdbServerNodeTcpConnector({
      host: options.serverHost ?? "127.0.0.1",
      port: options.serverPort ?? 5037,
    });
    this.serverClient = new AdbServerClient(connector);
  }

  // ========================
  //  Internal helpers
  // ========================

  /**
   * Get or create an Adb instance for a device by serial.
   */
  private async getAdb(serial: string): Promise<Adb> {
    const cached = this.deviceConnections.get(serial);
    if (cached) return cached;

    const devices = await this.serverClient.getDevices();
    const device = devices.find((d) => d.serial === serial);
    if (!device) throw new Error(`Device not found: ${serial}`);

    const adb = await this.serverClient.createAdb({
      transportId: device.transportId,
    });
    this.deviceConnections.set(serial, adb);
    return adb;
  }

  /**
   * Execute a CLI command (for operations not supported by the protocol).
   */
  private execCli(
    args: string[],
    options: { timeout?: number } = {},
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const timeout = options.timeout ?? 30000;
    return new Promise((resolve, reject) => {
      const proc = spawn(this.adbPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        proc.kill("SIGTERM");
        reject(new Error(`ADB command timed out after ${timeout}ms`));
      }, timeout);

      proc.stdout.on("data", (d) => (stdout += d.toString()));
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (!killed) resolve({ stdout, stderr, exitCode: code ?? 0 });
      });
      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Execute a CLI command with stdin input.
   */
  private execCliWithStdin(
    args: string[],
    input: string,
    options: { timeout?: number } = {},
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const timeout = options.timeout ?? 30000;
    return new Promise((resolve, reject) => {
      const proc = spawn(this.adbPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        proc.kill("SIGTERM");
        reject(new Error(`ADB command timed out after ${timeout}ms`));
      }, timeout);

      proc.stdout.on("data", (d) => (stdout += d.toString()));
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (!killed) resolve({ stdout, stderr, exitCode: code ?? 0 });
      });
      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      proc.stdin?.write(input + "\n");
      proc.stdin?.end();
    });
  }

  // ========================
  //  Connection management
  // ========================

  /**
   * Invalidate all cached device connections.
   * Call when the device list changes (disconnect, reboot, etc.).
   */
  invalidateConnections(): void {
    for (const adb of this.deviceConnections.values()) {
      adb.close();
    }
    this.deviceConnections.clear();
  }

  /**
   * Invalidate a specific device connection.
   */
  invalidateDevice(serial: string): void {
    const adb = this.deviceConnections.get(serial);
    if (adb) {
      adb.close();
      this.deviceConnections.delete(serial);
    }
  }

  /**
   * Dispose of the client and all connections.
   */
  dispose(): void {
    this.invalidateConnections();
  }

  // ========================
  //  Server-level operations
  // ========================

  /**
   * Get list of connected devices.
   */
  async getDevices(): Promise<Device[]> {
    const devices = await this.serverClient.getDevices([
      "device",
      "unauthorized",
      "offline",
    ]);
    return devices.map((d) => {
      const connectionType = detectConnectionType(d.serial);
      return {
        serial: d.serial,
        state: mapServerState(d.state),
        model: d.model,
        product: d.product,
        device: d.device,
        transportId: d.transportId,
        isEmulator: connectionType === "emulator",
        connectionType,
      };
    });
  }

  /**
   * Get ADB server version.
   */
  async getServerVersion(): Promise<number> {
    return this.serverClient.getVersion();
  }

  /**
   * Start the ADB server (CLI fallback).
   */
  async startServer(): Promise<void> {
    await this.execCli(["start-server"]);
  }

  /**
   * Kill the ADB server.
   */
  async killServer(): Promise<void> {
    await this.serverClient.killServer();
    this.invalidateConnections();
  }

  /**
   * Connect to a device over TCP/IP (CLI fallback).
   */
  async connect(host: string, port: number = 5555): Promise<string> {
    const result = await this.execCli(["connect", `${host}:${port}`]);
    return result.stdout.trim();
  }

  /**
   * Disconnect from a TCP/IP device (CLI fallback).
   */
  async disconnect(host?: string, port?: number): Promise<string> {
    const args = host
      ? ["disconnect", `${host}:${port ?? 5555}`]
      : ["disconnect"];
    const result = await this.execCli(args);
    this.invalidateConnections();
    return result.stdout.trim();
  }

  /**
   * Pair with a device for wireless debugging (Android 11+, CLI fallback).
   */
  async pairDevice(
    host: string,
    port: number,
    pairingCode: string,
  ): Promise<string> {
    const result = await this.execCliWithStdin(
      ["pair", `${host}:${port}`],
      pairingCode,
    );
    return (result.stdout + result.stderr).trim();
  }

  /**
   * Discover devices via mDNS (CLI fallback).
   */
  async listMdnsServices(): Promise<
    { name: string; type: string; address: string }[]
  > {
    const result = await this.execCli(["mdns", "services"], { timeout: 5000 });
    const lines = result.stdout.split("\n");
    const services: { name: string; type: string; address: string }[] = [];

    for (const line of lines) {
      const parts = line.trim().split("\t");
      if (parts.length >= 3) {
        services.push({ name: parts[0], type: parts[1], address: parts[2] });
      }
    }

    return services;
  }

  /**
   * Check if mDNS is supported (CLI fallback).
   */
  async isMdnsSupported(): Promise<boolean> {
    try {
      const result = await this.execCli(["mdns", "check"], { timeout: 5000 });
      return result.stdout.includes("mdns daemon running");
    } catch {
      return false;
    }
  }

  // ========================
  //  Device-level operations
  // ========================

  /**
   * Run a shell command on a device and return stdout as a string.
   */
  async shell(serial: string, command: string): Promise<string> {
    const adb = await this.getAdb(serial);
    const proc = await adb.subprocess.noneProtocol.spawn(command);
    return collectText(proc.output);
  }

  /**
   * Get all device properties via getprop.
   */
  async getDeviceProps(
    serial: string,
  ): Promise<Record<string, string>> {
    const output = await this.shell(serial, "getprop");
    const props: Record<string, string> = {};
    const regex = /\[([^\]]+)\]: \[([^\]]*)\]/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
      props[match[1]] = match[2];
    }
    return props;
  }

  /**
   * Get friendly device name.
   */
  async getDeviceName(serial: string): Promise<string> {
    const props = await this.getDeviceProps(serial);
    return props["ro.product.model"] ?? props["ro.product.name"] ?? serial;
  }

  /**
   * Get Android API level.
   */
  async getApiLevel(serial: string): Promise<number> {
    const adb = await this.getAdb(serial);
    const output = await adb.getProp("ro.build.version.sdk");
    const level = parseInt(output.trim(), 10);
    return isNaN(level) ? 0 : level;
  }

  /**
   * Get Android version string (e.g., "14").
   */
  async getAndroidVersion(serial: string): Promise<string> {
    const adb = await this.getAdb(serial);
    return (await adb.getProp("ro.build.version.release")).trim();
  }

  /**
   * Take a screenshot and save to local file.
   */
  async takeScreenshot(
    serial: string,
    localPath: string,
  ): Promise<void> {
    const remotePath = "/sdcard/screenshot.png";
    await this.shell(serial, `screencap -p ${shellQuote(remotePath)}`);
    await this.pullFile(serial, remotePath, localPath);
    await this.shell(serial, `rm ${shellQuote(remotePath)}`);
  }

  /**
   * Reboot the device.
   */
  async reboot(
    serial: string,
    mode?: "bootloader" | "recovery" | "sideload",
  ): Promise<void> {
    const adb = await this.getAdb(serial);
    if (mode) {
      await adb.power.reboot(mode);
    } else {
      await adb.power.reboot();
    }
    this.invalidateDevice(serial);
  }

  /**
   * Install an APK on the device via streaming install.
   */
  async installApk(
    serial: string,
    apkPath: string,
    options: { replace?: boolean; allowDowngrade?: boolean } = {},
  ): Promise<void> {
    const adb = await this.getAdb(serial);
    const pm = new PackageManager(adb);
    const stat = fs.statSync(apkPath);
    const nodeStream = fs.createReadStream(apkPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    await pm.installStream(stat.size, webStream, {
      requestDowngrade: options.allowDowngrade,
    });
  }

  /**
   * Uninstall a package from the device.
   */
  async uninstallPackage(
    serial: string,
    packageName: string,
    keepData: boolean = false,
  ): Promise<void> {
    const adb = await this.getAdb(serial);
    const pm = new PackageManager(adb);
    await pm.uninstall(packageName, { keepData });
  }

  /**
   * Launch a deep link URI on the device.
   */
  async launchDeepLink(serial: string, uri: string): Promise<string> {
    const output = await this.shell(
      serial,
      `am start -a android.intent.action.VIEW -d ${shellQuote(uri)}`,
    );
    if (output.includes("Error")) {
      throw new Error(`Failed to launch deep link: ${output}`);
    }
    return output.trim();
  }

  /**
   * Record the device screen and save to local file.
   */
  async recordScreen(
    serial: string,
    localPath: string,
    duration: number = 10,
  ): Promise<void> {
    const remotePath = "/sdcard/screenrecord.mp4";
    await this.shell(
      serial,
      `screenrecord --time-limit ${duration} ${shellQuote(remotePath)}`,
    );
    await this.pullFile(serial, remotePath, localPath);
    await this.shell(serial, `rm ${shellQuote(remotePath)}`);
  }

  /**
   * Get runtime permissions for a package.
   */
  async getAppPermissions(
    serial: string,
    packageName: string,
  ): Promise<{ permission: string; granted: boolean }[]> {
    const output = await this.shell(
      serial,
      `dumpsys package ${shellQuote(packageName)}`,
    );
    const permissions: { permission: string; granted: boolean }[] = [];

    const runtimeSection = output.match(
      /runtime permissions:[\s\S]*?(?=\n\s*\S+:|$)/,
    );
    if (!runtimeSection) return permissions;

    const lines = runtimeSection[0].split("\n");
    for (const line of lines) {
      const match = line.match(
        /^\s+(android\.permission\.\S+):\s+granted=(\w+)/,
      );
      if (match) {
        permissions.push({
          permission: match[1],
          granted: match[2] === "true",
        });
      }
    }

    return permissions;
  }

  /**
   * Grant a runtime permission to a package.
   */
  async grantPermission(
    serial: string,
    packageName: string,
    permission: string,
  ): Promise<void> {
    await this.shell(
      serial,
      `pm grant ${shellQuote(packageName)} ${shellQuote(permission)}`,
    );
  }

  /**
   * Revoke a runtime permission from a package.
   */
  async revokePermission(
    serial: string,
    packageName: string,
    permission: string,
  ): Promise<void> {
    await this.shell(
      serial,
      `pm revoke ${shellQuote(packageName)} ${shellQuote(permission)}`,
    );
  }

  /**
   * Launch an app by package name.
   */
  async launchApp(
    serial: string,
    packageName: string,
    activity?: string,
  ): Promise<void> {
    if (activity) {
      await this.shell(
        serial,
        `am start -n ${shellQuote(`${packageName}/${activity}`)}`,
      );
    } else {
      await this.shell(
        serial,
        `monkey -p ${shellQuote(packageName)} -c android.intent.category.LAUNCHER 1`,
      );
    }
  }

  /**
   * Force stop an app.
   */
  async forceStopApp(
    serial: string,
    packageName: string,
  ): Promise<void> {
    await this.shell(serial, `am force-stop ${shellQuote(packageName)}`);
  }

  /**
   * Clear app data.
   */
  async clearAppData(
    serial: string,
    packageName: string,
  ): Promise<void> {
    await this.shell(serial, `pm clear ${shellQuote(packageName)}`);
  }

  /**
   * Enable TCP/IP mode on a USB-connected device.
   */
  async enableTcpip(
    serial: string,
    port: number = 5555,
  ): Promise<string> {
    const adb = await this.getAdb(serial);
    const result = await adb.tcpip.setPort(port);
    this.invalidateDevice(serial);
    return result;
  }

  /**
   * List installed packages on a device.
   */
  async listPackages(serial: string): Promise<string[]> {
    const output = await this.shell(serial, "pm list packages");
    return output
      .split("\n")
      .filter((l) => l.startsWith("package:"))
      .map((l) => l.replace("package:", "").trim());
  }

  /**
   * Get the PID of a running package.
   */
  async getPidForPackage(
    serial: string,
    packageName: string,
  ): Promise<number | null> {
    const output = await this.shell(
      serial,
      `pidof ${shellQuote(packageName)}`,
    );
    const pid = parseInt(output.trim(), 10);
    return isNaN(pid) ? null : pid;
  }

  /**
   * List files on a device path.
   */
  async listFiles(
    serial: string,
    remotePath: string,
  ): Promise<
    {
      name: string;
      type: "file" | "directory" | "link" | "other";
      size: number;
      permissions: string;
      modifiedDate: string;
    }[]
  > {
    const adb = await this.getAdb(serial);
    const sync = await adb.sync();
    try {
      const entries = await sync.readdir(remotePath);
      return entries
        .filter((e) => e.name !== "." && e.name !== "..")
        .map((entry) => {
          let type: "file" | "directory" | "link" | "other" = "other";
          if (entry.type === LinuxFileType.Directory) type = "directory";
          else if (entry.type === LinuxFileType.File) type = "file";
          else if (entry.type === LinuxFileType.Link) type = "link";

          const perm = entry.permission;
          const permStr = formatPermissions(entry.type, perm);

          const mtime = new Date(Number(entry.mtime) * 1000);
          const modifiedDate = formatDate(mtime);

          return {
            name: entry.name,
            type,
            size: Number(entry.size),
            permissions: permStr,
            modifiedDate,
          };
        });
    } finally {
      await sync.dispose();
    }
  }

  /**
   * Pull a file from device to local path via sync protocol.
   */
  async pullFile(
    serial: string,
    remotePath: string,
    localPath: string,
  ): Promise<void> {
    const adb = await this.getAdb(serial);
    const sync = await adb.sync();
    try {
      const stream = sync.read(remotePath);
      const reader = stream.getReader();
      const writeStream = fs.createWriteStream(localPath);
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          writeStream.write(value);
        }
      } finally {
        reader.releaseLock();
        await new Promise<void>((resolve, reject) => {
          writeStream.end((err: Error | null) => (err ? reject(err) : resolve()));
        });
      }
    } finally {
      await sync.dispose();
    }
  }

  /**
   * Push a local file to device via sync protocol.
   */
  async pushFile(
    serial: string,
    localPath: string,
    remotePath: string,
  ): Promise<void> {
    const adb = await this.getAdb(serial);
    const sync = await adb.sync();
    try {
      const nodeStream = fs.createReadStream(localPath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
      await sync.write({
        filename: remotePath,
        file: webStream,
      });
    } finally {
      await sync.dispose();
    }
  }

  /**
   * Delete a file or directory on device.
   */
  async deleteFile(
    serial: string,
    remotePath: string,
    recursive: boolean = false,
  ): Promise<void> {
    if (recursive) {
      await this.shell(serial, `rm -rf ${shellQuote(remotePath)}`);
    } else {
      const adb = await this.getAdb(serial);
      await adb.rm(remotePath);
    }
  }

  /**
   * Get the AVD name for a running emulator instance (CLI fallback).
   */
  async getEmulatorAvdName(
    serial: string,
  ): Promise<string | undefined> {
    try {
      const result = await this.execCli(["-s", serial, "emu", "avd", "name"]);
      const name = result.stdout.split("\n")[0]?.trim();
      return name && name !== "OK" ? name : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get the ADB binary path.
   */
  getAdbPath(): string {
    return this.adbPath;
  }

  /**
   * Create a Logcat instance for a device.
   * Returns a Tango Logcat object that provides binary() and clear() methods.
   */
  async createLogcat(serial: string): Promise<Logcat> {
    const adb = await this.getAdb(serial);
    return new Logcat(adb);
  }

  /**
   * Create a PackageManager instance for a device.
   */
  async createPackageManager(serial: string): Promise<PackageManager> {
    const adb = await this.getAdb(serial);
    return new PackageManager(adb);
  }
}
