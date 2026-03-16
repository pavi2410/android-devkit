import type { AdbClient } from "./client.js";
import type { ConnectionType, Device, DeviceState } from "./types.js";

/**
 * Parse a device line from `adb devices -l` output
 */
function parseDeviceLine(line: string): Device | null {
  // Format: serial state [key:value ...]
  // Example: emulator-5554 device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const serial = parts[0];
  const state = parts[1] as DeviceState;

  // Parse key:value pairs
  const props: Record<string, string> = {};
  for (let i = 2; i < parts.length; i++) {
    const [key, value] = parts[i].split(":");
    if (key && value) {
      props[key] = value;
    }
  }

  const connectionType = detectConnectionType(serial);

  return {
    serial,
    state,
    model: props["model"],
    product: props["product"],
    device: props["device"],
    transportId: props["transport_id"],
    isEmulator: connectionType === "emulator",
    connectionType,
  };
}

/**
 * Get list of connected devices
 */
export async function getDevices(client: AdbClient): Promise<Device[]> {
  const result = await client.exec(["devices", "-l"]);
  const lines = result.stdout.split("\n");

  const devices: Device[] = [];
  for (const line of lines) {
    // Skip header line and empty lines
    if (line.startsWith("List of devices") || !line.trim()) continue;

    const device = parseDeviceLine(line);
    if (device) {
      devices.push(device);
    }
  }

  return devices;
}

/**
 * Get detailed device properties via getprop
 */
export async function getDeviceProps(
  client: AdbClient,
  serial: string
): Promise<Record<string, string>> {
  const result = await client.shell("getprop", { serial });
  const props: Record<string, string> = {};

  // Parse [key]: [value] format
  const regex = /\[([^\]]+)\]: \[([^\]]*)\]/g;
  let match;
  while ((match = regex.exec(result.stdout)) !== null) {
    props[match[1]] = match[2];
  }

  return props;
}

/**
 * Get friendly device name
 */
export async function getDeviceName(
  client: AdbClient,
  serial: string
): Promise<string> {
  const props = await getDeviceProps(client, serial);
  return (
    props["ro.product.model"] ??
    props["ro.product.name"] ??
    serial
  );
}

/**
 * Get Android API level
 */
export async function getApiLevel(
  client: AdbClient,
  serial: string
): Promise<number> {
  const result = await client.shell("getprop ro.build.version.sdk", { serial });
  return parseInt(result.stdout.trim(), 10);
}

/**
 * Get Android version string (e.g., "14")
 */
export async function getAndroidVersion(
  client: AdbClient,
  serial: string
): Promise<string> {
  const result = await client.shell("getprop ro.build.version.release", { serial });
  return result.stdout.trim();
}

/**
 * Take a screenshot and save to local file
 */
export async function takeScreenshot(
  client: AdbClient,
  serial: string,
  localPath: string
): Promise<void> {
  const remotePath = "/sdcard/screenshot.png";
  await client.shell(`screencap -p ${remotePath}`, { serial });
  await client.exec(["pull", remotePath, localPath], { serial });
  await client.shell(`rm ${remotePath}`, { serial });
}

/**
 * Reboot the device
 */
export async function reboot(
  client: AdbClient,
  serial: string,
  mode?: "bootloader" | "recovery" | "sideload"
): Promise<void> {
  const args = mode ? ["reboot", mode] : ["reboot"];
  await client.exec(args, { serial });
}

/**
 * Install an APK on the device
 */
export async function installApk(
  client: AdbClient,
  serial: string,
  apkPath: string,
  options: { replace?: boolean; allowDowngrade?: boolean } = {}
): Promise<void> {
  const args = ["install"];
  if (options.replace) args.push("-r");
  if (options.allowDowngrade) args.push("-d");
  args.push(apkPath);

  const result = await client.exec(args, { serial, timeout: 120000 });
  if (!result.stdout.includes("Success")) {
    throw new Error(`Failed to install APK: ${result.stdout} ${result.stderr}`);
  }
}

/**
 * Uninstall a package from the device
 */
export async function uninstallPackage(
  client: AdbClient,
  serial: string,
  packageName: string,
  keepData: boolean = false
): Promise<void> {
  const args = keepData
    ? ["uninstall", "-k", packageName]
    : ["uninstall", packageName];

  const result = await client.exec(args, { serial });
  if (!result.stdout.includes("Success")) {
    throw new Error(`Failed to uninstall package: ${result.stdout} ${result.stderr}`);
  }
}

/**
 * Launch a deep link URI on the device
 */
export async function launchDeepLink(
  client: AdbClient,
  serial: string,
  uri: string
): Promise<string> {
  const result = await client.shell(
    `am start -a android.intent.action.VIEW -d '${uri}'`,
    { serial }
  );
  const output = (result.stdout + result.stderr).trim();
  if (output.includes("Error")) {
    throw new Error(`Failed to launch deep link: ${output}`);
  }
  return output;
}

/**
 * Record the device screen
 */
export async function recordScreen(
  client: AdbClient,
  serial: string,
  localPath: string,
  duration: number = 10
): Promise<void> {
  const remotePath = "/sdcard/screenrecord.mp4";
  await client.shell(`screenrecord --time-limit ${duration} ${remotePath}`, {
    serial,
    timeout: (duration + 5) * 1000,
  });
  await client.exec(["pull", remotePath, localPath], { serial });
  await client.shell(`rm ${remotePath}`, { serial });
}

/**
 * Get runtime permissions for a package
 */
export async function getAppPermissions(
  client: AdbClient,
  serial: string,
  packageName: string
): Promise<{ permission: string; granted: boolean }[]> {
  const result = await client.shell(`dumpsys package ${packageName}`, {
    serial,
  });
  const permissions: { permission: string; granted: boolean }[] = [];

  // Parse runtime permissions section
  const runtimeSection = result.stdout.match(
    /runtime permissions:[\s\S]*?(?=\n\s*\S+:|$)/
  );
  if (!runtimeSection) return permissions;

  const lines = runtimeSection[0].split("\n");
  for (const line of lines) {
    const match = line.match(
      /^\s+(android\.permission\.\S+):\s+granted=(\w+)/
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
 * Grant a runtime permission to a package
 */
export async function grantPermission(
  client: AdbClient,
  serial: string,
  packageName: string,
  permission: string
): Promise<void> {
  await client.shell(`pm grant ${packageName} ${permission}`, { serial });
}

/**
 * Revoke a runtime permission from a package
 */
export async function revokePermission(
  client: AdbClient,
  serial: string,
  packageName: string,
  permission: string
): Promise<void> {
  await client.shell(`pm revoke ${packageName} ${permission}`, { serial });
}

/**
 * Launch an app by package name
 */
export async function launchApp(
  client: AdbClient,
  serial: string,
  packageName: string,
  activity?: string
): Promise<void> {
  if (activity) {
    await client.shell(
      `am start -n ${packageName}/${activity}`,
      { serial }
    );
  } else {
    // Launch the default launcher activity
    await client.shell(
      `monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`,
      { serial }
    );
  }
}

/**
 * Force stop an app
 */
export async function forceStopApp(
  client: AdbClient,
  serial: string,
  packageName: string
): Promise<void> {
  await client.shell(`am force-stop ${packageName}`, { serial });
}

/**
 * Clear app data
 */
export async function clearAppData(
  client: AdbClient,
  serial: string,
  packageName: string
): Promise<void> {
  await client.shell(`pm clear ${packageName}`, { serial });
}

/**
 * Detect how a device is connected based on its serial format
 *
 * - `emulator-XXXX` → emulator
 * - `IP:5555` → tcpip (legacy `adb tcpip 5555`)
 * - `IP:XXXXX` (high port, typically 37000-44000) → wireless (Android 11+ wireless debugging via mDNS)
 * - `adb-*` prefix with mDNS service name → wireless
 * - anything else → usb
 */
function detectConnectionType(serial: string): ConnectionType {
  if (serial.startsWith("emulator-")) {
    return "emulator";
  }

  // Network device: IP:PORT
  const ipPortMatch = serial.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/);
  if (ipPortMatch) {
    const port = parseInt(ipPortMatch[2], 10);
    // Port 5555 is the conventional `adb tcpip` port
    if (port === 5555) {
      return "tcpip";
    }
    // High ports are used by Android 11+ wireless debugging
    return "wireless";
  }

  // mDNS-discovered device (adb-SERIAL-XXXXXX)
  if (serial.startsWith("adb-")) {
    return "wireless";
  }

  return "usb";
}

/**
 * Pair with a device for wireless debugging (Android 11+)
 */
export async function pairDevice(
  client: AdbClient,
  host: string,
  port: number,
  pairingCode: string
): Promise<string> {
  const result = await client.execWithStdin(
    ["pair", `${host}:${port}`],
    pairingCode
  );
  return (result.stdout + result.stderr).trim();
}

/**
 * Discover devices via mDNS (requires ADB 31+)
 */
export async function listMdnsServices(
  client: AdbClient
): Promise<{ name: string; type: string; address: string }[]> {
  const result = await client.exec(["mdns", "services"], { timeout: 5000 });
  const lines = result.stdout.split("\n");
  const services: { name: string; type: string; address: string }[] = [];

  for (const line of lines) {
    // Format: name\ttype\taddress
    const parts = line.trim().split("\t");
    if (parts.length >= 3) {
      services.push({ name: parts[0], type: parts[1], address: parts[2] });
    }
  }

  return services;
}

/**
 * Check if mDNS is supported
 */
export async function isMdnsSupported(client: AdbClient): Promise<boolean> {
  try {
    const result = await client.exec(["mdns", "check"], { timeout: 5000 });
    return result.stdout.includes("mdns daemon running");
  } catch {
    return false;
  }
}

/**
 * Enable TCP/IP mode on a USB-connected device
 */
export async function enableTcpip(
  client: AdbClient,
  serial: string,
  port: number = 5555
): Promise<string> {
  const result = await client.exec(["tcpip", port.toString()], { serial });
  return result.stdout.trim();
}

/**
 * List installed packages on a device
 */
export async function listPackages(
  client: AdbClient,
  serial: string
): Promise<string[]> {
  const result = await client.shell("pm list packages", { serial });
  return result.stdout
    .split("\n")
    .filter((l) => l.startsWith("package:"))
    .map((l) => l.replace("package:", "").trim());
}

/**
 * Get the PID of a running package
 */
export async function getPidForPackage(
  client: AdbClient,
  serial: string,
  packageName: string
): Promise<number | null> {
  const result = await client.shell(`pidof ${packageName}`, { serial });
  const pid = parseInt(result.stdout.trim(), 10);
  return isNaN(pid) ? null : pid;
}

/**
 * List files on a device path
 */
export async function listFiles(
  client: AdbClient,
  serial: string,
  remotePath: string
): Promise<{ name: string; type: "file" | "directory" | "link" | "other"; size: number; permissions: string; modifiedDate: string }[]> {
  const result = await client.shell(`ls -la ${remotePath}`, { serial });
  const lines = result.stdout.split("\n");
  const files: { name: string; type: "file" | "directory" | "link" | "other"; size: number; permissions: string; modifiedDate: string }[] = [];

  for (const line of lines) {
    // Format: permissions links owner group size date time name [-> target]
    // Example: drwxr-xr-x  2 root root 4096 2024-01-01 00:00 dirname
    // Example: -rw-r--r--  1 root root 1234 2024-01-01 00:00 filename
    const match = line.match(/^([dlcbps-][rwxsStT-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+)$/);
    if (!match) continue;

    const [, permissions, sizeStr, modifiedDate, nameRaw] = match;
    let name = nameRaw.trim();

    // Skip . and ..
    if (name === "." || name === "..") continue;

    // Handle symlinks: name -> target
    if (name.includes(" -> ")) {
      name = name.split(" -> ")[0];
    }

    let type: "file" | "directory" | "link" | "other" = "other";
    if (permissions.startsWith("d")) type = "directory";
    else if (permissions.startsWith("-")) type = "file";
    else if (permissions.startsWith("l")) type = "link";

    files.push({
      name,
      type,
      size: parseInt(sizeStr, 10),
      permissions,
      modifiedDate,
    });
  }

  return files;
}

/**
 * Pull a file from device to local path
 */
export async function pullFile(
  client: AdbClient,
  serial: string,
  remotePath: string,
  localPath: string
): Promise<void> {
  const result = await client.exec(["pull", remotePath, localPath], { serial, timeout: 120000 });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to pull file: ${result.stderr}`);
  }
}

/**
 * Push a local file to device
 */
export async function pushFile(
  client: AdbClient,
  serial: string,
  localPath: string,
  remotePath: string
): Promise<void> {
  const result = await client.exec(["push", localPath, remotePath], { serial, timeout: 120000 });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to push file: ${result.stderr}`);
  }
}

/**
 * Delete a file or directory on device
 */
export async function deleteFile(
  client: AdbClient,
  serial: string,
  remotePath: string,
  recursive: boolean = false
): Promise<void> {
  const cmd = recursive ? `rm -rf ${remotePath}` : `rm ${remotePath}`;
  await client.shell(cmd, { serial });
}

/**
 * Get the AVD name for a running emulator instance.
 * Returns undefined if the device is not an emulator or if the query fails.
 */
export async function getEmulatorAvdName(
  client: AdbClient,
  serial: string
): Promise<string | undefined> {
  try {
    const result = await client.exec(["-s", serial, "emu", "avd", "name"]);
    // The output is the AVD name on the first line, followed by "OK" on the second
    const name = result.stdout.split("\n")[0]?.trim();
    return name && name !== "OK" ? name : undefined;
  } catch {
    return undefined;
  }
}
