import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Avd, DeviceProfile, CreateAvdOptions } from "./types.js";

export type { Avd, DeviceProfile, CreateAvdOptions };

const execFileAsync = promisify(execFile);

/**
 * Resolve avdmanager path from the SDK root.
 */
export function getAvdManagerPath(sdkPath: string): string | undefined {
  const ext = process.platform === "win32" ? ".bat" : "";
  const latestPath = path.join(sdkPath, "cmdline-tools", "latest", "bin", `avdmanager${ext}`);
  if (fs.existsSync(latestPath)) return latestPath;

  const cmdlineToolsDir = path.join(sdkPath, "cmdline-tools");
  if (!fs.existsSync(cmdlineToolsDir)) return undefined;

  for (const entry of fs.readdirSync(cmdlineToolsDir)) {
    if (entry === "latest") continue;
    const candidate = path.join(cmdlineToolsDir, entry, "bin", `avdmanager${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return undefined;
}

/**
 * Resolve emulator path from the SDK root.
 */
export function getEmulatorPath(sdkPath: string): string | undefined {
  const ext = process.platform === "win32" ? ".exe" : "";
  const p = path.join(sdkPath, "emulator", `emulator${ext}`);
  return fs.existsSync(p) ? p : undefined;
}

/**
 * Parse `avdmanager list avd` output into Avd[].
 */
export function parseAvdList(output: string): Avd[] {
  const avds: Avd[] = [];
  const blocks = output.split(/\n-{2,}\n/);

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim());
    const nameLine = lines.find((l) => l.startsWith("Name:"));
    if (!nameLine) continue;

    const get = (prefix: string) =>
      lines.find((l) => l.startsWith(prefix))?.slice(prefix.length).trim() ?? "";

    const name = get("Name: ");
    const target = get("Based on: ");
    const abi = get("Tag/ABI: ");
    const device = get("Device: ");
    const avdPath = get("Path: ");

    const apiMatch = get("Based on: ").match(/API level (\d+)/);
    const api = apiMatch ? parseInt(apiMatch[1], 10) : 0;

    if (name) {
      avds.push({ name, target, api, abi, device, path: avdPath });
    }
  }

  return avds;
}

/**
 * Parse `avdmanager list device` output into DeviceProfile[].
 */
export function parseDeviceProfiles(output: string): DeviceProfile[] {
  const profiles: DeviceProfile[] = [];
  const blocks = output.split(/\n-{2,}\n/);

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim());
    const idLine = lines.find((l) => l.startsWith("id:"));
    if (!idLine) continue;

    const idMatch = idLine.match(/id:\s+\d+\s+or\s+"([^"]+)"/);
    const id = idMatch?.[1] ?? "";

    const nameLine = lines.find((l) => l.startsWith("Name:"));
    const name = nameLine?.slice("Name:".length).trim() ?? id;

    const oemLine = lines.find((l) => l.startsWith("OEM:"));
    const oem = oemLine?.slice("OEM:".length).trim() ?? "";

    if (id) {
      profiles.push({ id, name, oem });
    }
  }

  return profiles;
}

/**
 * List all AVDs.
 */
export async function listAvds(sdkPath: string): Promise<Avd[]> {
  const avdManagerPath = getAvdManagerPath(sdkPath);
  if (!avdManagerPath) {
    throw new Error(`avdmanager not found in SDK at: ${sdkPath}`);
  }

  const { stdout } = await execFileAsync(avdManagerPath, ["list", "avd"], {
    timeout: 30000,
  });

  return parseAvdList(stdout);
}

/**
 * List available hardware device profiles.
 */
export async function listDeviceProfiles(sdkPath: string): Promise<DeviceProfile[]> {
  const avdManagerPath = getAvdManagerPath(sdkPath);
  if (!avdManagerPath) {
    throw new Error(`avdmanager not found in SDK at: ${sdkPath}`);
  }

  const { stdout } = await execFileAsync(avdManagerPath, ["list", "device"], {
    timeout: 30000,
  });

  return parseDeviceProfiles(stdout);
}

/**
 * Create a new AVD.
 */
export async function createAvd(sdkPath: string, opts: CreateAvdOptions): Promise<void> {
  const avdManagerPath = getAvdManagerPath(sdkPath);
  if (!avdManagerPath) {
    throw new Error(`avdmanager not found in SDK at: ${sdkPath}`);
  }

  const args = [
    "create", "avd",
    "-n", opts.name,
    "-k", opts.systemImage,
    "-d", opts.device,
  ];

  if (opts.force) args.push("--force");
  if (opts.sdcard) args.push("--sdcard", opts.sdcard);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(avdManagerPath, args);

    proc.stdin.write("no\n");

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`avdmanager exited with code ${code}`));
    });

    proc.on("error", reject);
  });
}

/**
 * Delete an AVD by name.
 */
export async function deleteAvd(sdkPath: string, name: string): Promise<void> {
  const avdManagerPath = getAvdManagerPath(sdkPath);
  if (!avdManagerPath) {
    throw new Error(`avdmanager not found in SDK at: ${sdkPath}`);
  }

  await execFileAsync(avdManagerPath, ["delete", "avd", "-n", name], {
    timeout: 30000,
  });
}

/**
 * Launch an AVD in the emulator (fire-and-forget, detached).
 */
export function launchAvd(sdkPath: string, name: string): void {
  const emulatorPath = getEmulatorPath(sdkPath);
  if (!emulatorPath) {
    throw new Error(`emulator not found in SDK at: ${sdkPath}`);
  }

  const proc = spawn(emulatorPath, ["-avd", name], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ANDROID_SDK_ROOT: sdkPath },
  });

  proc.unref();
}

/**
 * Wipe AVD user data by launching emulator with -wipe-data flag.
 */
export function wipeAvdData(sdkPath: string, name: string): void {
  const emulatorPath = getEmulatorPath(sdkPath);
  if (!emulatorPath) {
    throw new Error(`emulator not found in SDK at: ${sdkPath}`);
  }

  const proc = spawn(emulatorPath, ["-avd", name, "-wipe-data", "-no-window"], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ANDROID_SDK_ROOT: sdkPath },
  });

  proc.unref();
}
