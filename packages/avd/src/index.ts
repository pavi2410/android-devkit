import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Avd, AvdConfig, DeviceProfile, CreateAvdOptions } from "./types.js";

export type { Avd, AvdConfig, DeviceProfile, CreateAvdOptions };

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
    const device = get("Device: ");
    const avdPath = get("Path: ");
    const sdcard = get("Sdcard: ") || undefined;

    // "Based on:" line may contain "Tag/ABI:" inline
    const basedOnRaw = get("Based on: ");
    let target = basedOnRaw;
    let abi = get("Tag/ABI: ");

    // Handle "Based on: Android API 0 Tag/ABI: google_apis_playstore/arm64-v8a"
    const tagAbiInline = basedOnRaw.match(/^(.+?)\s+Tag\/ABI:\s*(.+)$/);
    if (tagAbiInline) {
      target = tagAbiInline[1].trim();
      if (!abi) abi = tagAbiInline[2].trim();
    }

    // Extract API level with multiple fallback patterns
    let api = 0;
    const apiPatterns = [
      /API level (\d+)/,
      /Android (\d+)/,
      /API (\d+)/,
      /android-(\d+(?:\.\d+)?)/,
    ];
    for (const pattern of apiPatterns) {
      const match = basedOnRaw.match(pattern);
      if (match) {
        api = parseInt(match[1], 10);
        if (api > 0) break;
      }
    }

    if (name) {
      avds.push({ name, target, api, abi, device, path: avdPath, sdcard });
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

    const oemLine = lines.find((l) => /^OEM\s*:/.test(l));
    const oem = oemLine?.replace(/^OEM\s*:\s*/, "").trim() ?? "";

    if (id) {
      profiles.push({ id, name, oem });
    }
  }

  return profiles;
}

/**
 * Parse an AVD config.ini file content into AvdConfig.
 */
export function parseAvdConfig(content: string): AvdConfig {
  const map = new Map<string, string>();
  for (const line of content.split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    if (key) map.set(key, value);
  }

  const getStr = (key: string) => map.get(key) || undefined;
  const getInt = (key: string) => {
    const v = map.get(key);
    return v ? parseInt(v, 10) : undefined;
  };
  const getBool = (key: string) => {
    const v = map.get(key);
    return v === "yes" || v === "true" ? true : v === "no" || v === "false" ? false : undefined;
  };

  return {
    displayName: getStr("avd.ini.displayname"),
    ram: getInt("hw.ramSize"),
    vmHeap: getInt("vm.heapSize"),
    sdcard: getStr("sdcard.size"),
    lcdWidth: getInt("hw.lcd.width"),
    lcdHeight: getInt("hw.lcd.height"),
    lcdDensity: getInt("hw.lcd.density"),
    cpuArch: getStr("hw.cpu.arch"),
    cpuCores: getInt("hw.cpu.ncore"),
    gpuEnabled: getBool("hw.gpu.enabled"),
    gpuMode: getStr("hw.gpu.mode"),
    playStoreEnabled: getBool("PlayStore.enabled"),
    skin: getStr("skin.name"),
    imageSysdir: getStr("image.sysdir.1"),
    targetApi: getStr("target"),
  };
}

/**
 * Read and parse config.ini from an AVD directory.
 */
export function readAvdConfig(avdPath: string): AvdConfig | undefined {
  const configPath = path.join(avdPath, "config.ini");
  if (!fs.existsSync(configPath)) return undefined;
  const content = fs.readFileSync(configPath, "utf-8");
  return parseAvdConfig(content);
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

  const avds = parseAvdList(stdout);

  // Enrich AVDs with config.ini data
  for (const avd of avds) {
    if (avd.path) {
      const config = readAvdConfig(avd.path);
      if (config) {
        avd.config = config;
        // Use config to fix API level if avdmanager reported 0
        if (avd.api === 0 && config.targetApi) {
          const apiMatch = config.targetApi.match(/android-(\d+)/);
          if (apiMatch) avd.api = parseInt(apiMatch[1], 10);
        }
      }
    }
  }

  return avds;
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
