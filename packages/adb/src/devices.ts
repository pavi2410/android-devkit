import type { AdbClient } from "./client.js";
import type { Device, DeviceState } from "./types.js";

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

  return {
    serial,
    state,
    model: props["model"],
    product: props["product"],
    device: props["device"],
    transportId: props["transport_id"],
    isEmulator: serial.startsWith("emulator-") || serial.includes(":5555"),
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
