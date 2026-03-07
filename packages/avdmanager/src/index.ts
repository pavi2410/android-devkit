import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Avd, AvdConfig, DeviceProfile, CreateAvdOptions } from "./types.js";

export type { Avd, AvdConfig, DeviceProfile, CreateAvdOptions };

const execFileAsync = promisify(execFile);
const shouldUseShell = process.platform === "win32";

function getAvdToolEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
  };

  if (process.platform === "win32" && !env.SKIP_JDK_VERSION_CHECK) {
    env.SKIP_JDK_VERSION_CHECK = "1";
  }

  return env;
}

function parseAvdBlock(lines: string[]): Avd | undefined {
  const get = (prefix: string) =>
    lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? "";

  const name = get("Name: ");
  if (!name) return undefined;

  const device = get("Device: ");
  const avdPath = get("Path: ");
  const sdcard = get("Sdcard: ") || undefined;
  const targetLine = get("Target: ");

  const basedOnRaw = get("Based on: ");
  let target = targetLine || basedOnRaw;
  let abi = get("Tag/ABI: ");

  const tagAbiInline = basedOnRaw.match(/^(.+?)\s+Tag\/ABI:\s*(.+)$/);
  if (tagAbiInline) {
    if (!targetLine) target = tagAbiInline[1].trim();
    if (!abi) abi = tagAbiInline[2].trim();
  }

  let api = 0;
  const apiPatterns = [
    /API level (\d+)/i,
    /Android API (\d+)/i,
    /Android (\d+)/i,
    /API (\d+)/i,
    /android-(\d+(?:\.\d+)?)/i,
  ];

  for (const source of [basedOnRaw, targetLine]) {
    for (const pattern of apiPatterns) {
      const match = source.match(pattern);
      if (match) {
        api = parseInt(match[1], 10);
        if (api > 0) break;
      }
    }
    if (api > 0) break;
  }

  return { name, target, api, abi, device, path: avdPath, sdcard };
}

function parseDeviceProfileBlock(lines: string[]): DeviceProfile | undefined {
  const idLine = lines.find((line) => line.startsWith("id:"));
  if (!idLine) return undefined;

  const idMatch = idLine.match(/id:\s+\d+\s+or\s+"([^"]+)"/);
  const id = idMatch?.[1] ?? "";
  if (!id) return undefined;

  const nameLine = lines.find((line) => line.startsWith("Name:"));
  const name = nameLine?.slice("Name:".length).trim() ?? id;

  const oemLine = lines.find((line) => /^OEM\s*:/.test(line));
  const oem = oemLine?.replace(/^OEM\s*:\s*/, "").trim() ?? "";

  return { id, name, oem };
}

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
 * Parse `avdmanager list avd` output into Avd[].
 */
export function parseAvdList(output: string): Avd[] {
  const avds: Avd[] = [];
  const lines = output.replace(/\r\n/g, "\n").split("\n");
  let currentBlock: string[] = [];

  const flushCurrentBlock = () => {
    const avd = parseAvdBlock(currentBlock.map((line) => line.trim()).filter(Boolean));
    if (avd) avds.push(avd);
    currentBlock = [];
  };

  for (const line of lines) {
    if (/^\s*Name:\s*/.test(line)) {
      if (currentBlock.length > 0) flushCurrentBlock();
      currentBlock = [line];
      continue;
    }

    if (currentBlock.length === 0) continue;

    if (/^\s*-{2,}\s*$/.test(line)) {
      flushCurrentBlock();
      continue;
    }

    currentBlock.push(line);
  }

  if (currentBlock.length > 0) flushCurrentBlock();

  return avds;
}

/**
 * Parse `avdmanager list device` output into DeviceProfile[].
 */
export function parseDeviceProfiles(output: string): DeviceProfile[] {
  const profiles: DeviceProfile[] = [];
  const lines = output.replace(/\r\n/g, "\n").split("\n");
  let currentBlock: string[] = [];

  const flushCurrentBlock = () => {
    const profile = parseDeviceProfileBlock(currentBlock.map((line) => line.trim()).filter(Boolean));
    if (profile) profiles.push(profile);
    currentBlock = [];
  };

  for (const line of lines) {
    if (/^\s*id:\s*/.test(line)) {
      if (currentBlock.length > 0) flushCurrentBlock();
      currentBlock = [line];
      continue;
    }

    if (currentBlock.length === 0) continue;

    if (/^\s*-{2,}\s*$/.test(line)) {
      flushCurrentBlock();
      continue;
    }

    currentBlock.push(line);
  }

  if (currentBlock.length > 0) flushCurrentBlock();

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
    shell: shouldUseShell,
    env: getAvdToolEnv(),
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
    shell: shouldUseShell,
    env: getAvdToolEnv(),
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
    const proc = spawn(avdManagerPath, args, { shell: shouldUseShell, env: getAvdToolEnv() });

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
    shell: shouldUseShell,
    env: getAvdToolEnv(),
  });
}
