import {
  resolveCommandLineToolPath,
} from "@android-devkit/android-sdk";
import {
  runCommand,
  runStreamingCommand,
  type StreamingCommand,
} from "@android-devkit/tool-core";
import type { SdkPackage, SdkPackageCategory } from "./types.js";

export type { SdkPackage, SdkPackageCategory };

const shouldUseShell = process.platform === "win32";

function getSdkToolEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    JAVA_OPTS: "-Dfile.encoding=UTF-8",
  };

  if (process.platform === "win32" && !env.SKIP_JDK_VERSION_CHECK) {
    env.SKIP_JDK_VERSION_CHECK = "1";
  }

  return env;
}

/**
 * Resolve the sdkmanager executable path from the SDK root.
 * Checks cmdline-tools/latest first, then falls back to any installed version.
 */
export function getSdkManagerPath(sdkPath: string): string | undefined {
  return resolveCommandLineToolPath(sdkPath, "sdkmanager");
}

/**
 * Detect category from a sdkmanager package id.
 */
function detectCategory(id: string): SdkPackageCategory {
  if (id.startsWith("platforms;")) return "platforms";
  if (id.startsWith("build-tools;")) return "build-tools";
  if (id === "platform-tools") return "platform-tools";
  if (id.startsWith("cmdline-tools;") || id === "cmdline-tools") return "cmdline-tools";
  if (id.startsWith("system-images;")) return "system-images";
  if (id.startsWith("extras;")) return "extras";
  if (id === "emulator") return "emulator";
  if (id.startsWith("ndk;") || id === "ndk-bundle") return "ndk";
  if (id.startsWith("sources;")) return "sources";
  if (id.startsWith("cmake;")) return "cmake";
  return "other";
}

/**
 * Parse a display name from a sdkmanager package id for readability.
 */
function parseDisplayName(id: string, rawDescription: string): string {
  if (rawDescription) return rawDescription.trim();

  if (id.startsWith("platforms;android-")) {
    const api = id.split(";")[1]?.replace("android-", "");
    return `Android ${api}`;
  }
  if (id.startsWith("build-tools;")) {
    return `Build Tools ${id.split(";")[1]}`;
  }
  if (id === "platform-tools") return "Platform Tools";
  if (id.startsWith("system-images;")) {
    const parts = id.split(";");
    return `${parts[1]} ${parts[2]} ${parts[3]}`.replace("android-", "Android ");
  }
  return id;
}

interface RawPackage {
  id: string;
  version: string;
  description: string;
}

function parseSection(lines: string[]): RawPackage[] {
  const results: RawPackage[] = [];
  let pastHeader = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!pastHeader && trimmed.startsWith("Path")) {
      pastHeader = true;
      continue;
    }
    if (trimmed.startsWith("---") || trimmed === "") continue;
    const cols = line.split("|").map((c) => c.trim());
    if (cols.length < 2) continue;
    const id = cols[0];
    if (!id || id.includes(" ")) continue;
    results.push({ id, version: cols[1] ?? "", description: cols[2] ?? "" });
  }
  return results;
}

/**
 * Parse the "Available Updates" section which has columns: ID | Installed | Available
 */
function parseUpdatesSection(lines: string[]): Map<string, { installed: string; available: string }> {
  const results = new Map<string, { installed: string; available: string }>();
  let pastHeader = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!pastHeader && (trimmed.startsWith("ID") || trimmed.startsWith("Path"))) {
      pastHeader = true;
      continue;
    }
    if (trimmed.startsWith("---") || trimmed === "") continue;
    const cols = line.split("|").map((c) => c.trim());
    if (cols.length < 3) continue;
    const id = cols[0];
    if (!id || id.includes(" ")) continue;
    results.set(id, { installed: cols[1], available: cols[2] });
  }
  return results;
}

/**
 * Parse sdkmanager --list output into SdkPackage[].
 * Handles four sections: Installed packages, Available Packages,
 * Available Obsolete Packages, and Available Updates.
 */
export function parseSdkManagerList(output: string): SdkPackage[] {
  const allLines = output.split("\n");

  // Split into section line arrays
  const installedLines: string[] = [];
  const availableLines: string[] = [];
  const obsoleteLines: string[] = [];
  const updatesLines: string[] = [];
  let section: "none" | "installed" | "available" | "obsolete" | "updates" = "none";

  for (const line of allLines) {
    const trimmed = line.trim();
    const trimmedLower = trimmed.toLowerCase();
    if (trimmedLower.startsWith("installed packages:")) { section = "installed"; continue; }
    if (trimmedLower.startsWith("available packages:")) { section = "available"; continue; }
    if (trimmedLower.startsWith("available obsolete packages:")) { section = "obsolete"; continue; }
    if (trimmedLower.startsWith("available updates:")) { section = "updates"; continue; }
    if (section === "installed") installedLines.push(line);
    else if (section === "available") availableLines.push(line);
    else if (section === "obsolete") obsoleteLines.push(line);
    else if (section === "updates") updatesLines.push(line);
  }

  const installedRaw = parseSection(installedLines);
  const availableRaw = parseSection(availableLines);
  const obsoleteRaw = parseSection(obsoleteLines);
  const updates = parseUpdatesSection(updatesLines);

  const installedMap = new Map<string, RawPackage>(installedRaw.map((p) => [p.id, p]));
  const emittedIds = new Set<string>();

  const packages: SdkPackage[] = [];

  // Emit all available (non-obsolete) packages, marking installed ones
  for (const p of availableRaw) {
    emittedIds.add(p.id);
    const update = updates.get(p.id);
    const isInstalled = installedMap.has(p.id);
    packages.push({
      id: p.id,
      displayName: parseDisplayName(p.id, p.description),
      version: p.version,
      installed: isInstalled,
      category: detectCategory(p.id),
      ...(update ? { installedVersion: update.installed, availableVersion: update.available } : {}),
    });
  }

  // Emit obsolete packages
  for (const p of obsoleteRaw) {
    if (emittedIds.has(p.id)) continue;
    emittedIds.add(p.id);
    const isInstalled = installedMap.has(p.id);
    packages.push({
      id: p.id,
      displayName: parseDisplayName(p.id, p.description),
      version: p.version,
      installed: isInstalled,
      category: detectCategory(p.id),
      obsolete: true,
    });
  }

  // Emit installed packages that don't appear in available or obsolete lists
  for (const p of installedRaw) {
    if (emittedIds.has(p.id)) continue;
    const update = updates.get(p.id);
    packages.push({
      id: p.id,
      displayName: parseDisplayName(p.id, p.description),
      version: p.version,
      installed: true,
      category: detectCategory(p.id),
      ...(update ? { installedVersion: update.installed, availableVersion: update.available } : {}),
    });
  }

  return packages;
}

/**
 * List all available and installed SDK packages.
 */
export async function listSdkPackages(sdkPath: string): Promise<SdkPackage[]> {
  const sdkManagerPath = getSdkManagerPath(sdkPath);
  if (!sdkManagerPath) {
    throw new Error(`sdkmanager not found in SDK at: ${sdkPath}`);
  }

  const { stdout } = await runCommand({
    command: sdkManagerPath,
    args: ["--list", "--include_obsolete"],
    shell: shouldUseShell,
    env: getSdkToolEnv(),
  });

  return parseSdkManagerList(stdout);
}

/**
 * List only installed SDK packages.
 */
export async function listInstalledPackages(sdkPath: string): Promise<SdkPackage[]> {
  const all = await listSdkPackages(sdkPath);
  return all.filter((p) => p.installed);
}

/**
 * Install an SDK package by id. Accepts license prompts automatically.
 * Returns a child process so callers can stream stdout/stderr.
 */
export function installSdkPackage(
  sdkPath: string,
  id: string
): StreamingCommand {
  const sdkManagerPath = getSdkManagerPath(sdkPath);
  if (!sdkManagerPath) {
    throw new Error(`sdkmanager not found in SDK at: ${sdkPath}`);
  }

  const command = runStreamingCommand({
    command: sdkManagerPath,
    args: ["--install", id],
    shell: shouldUseShell,
    env: getSdkToolEnv(),
  });

  // Automatically accept all license prompts
  const acceptLicenses = () => {
    command.process.stdin?.write("y\n");
  };
  command.process.stdout?.on("data", acceptLicenses);

  return command;
}

/**
 * Uninstall an SDK package by id.
 */
export async function uninstallSdkPackage(sdkPath: string, id: string): Promise<void> {
  const sdkManagerPath = getSdkManagerPath(sdkPath);
  if (!sdkManagerPath) {
    throw new Error(`sdkmanager not found in SDK at: ${sdkPath}`);
  }

  await runCommand({
    command: sdkManagerPath,
    args: ["--uninstall", id],
    shell: shouldUseShell,
    env: getSdkToolEnv(),
  });
}

/**
 * Update all installed SDK packages.
 */
export function updateAllSdkPackages(sdkPath: string): StreamingCommand {
  const sdkManagerPath = getSdkManagerPath(sdkPath);
  if (!sdkManagerPath) {
    throw new Error(`sdkmanager not found in SDK at: ${sdkPath}`);
  }

  const command = runStreamingCommand({
    command: sdkManagerPath,
    args: ["--update"],
    shell: shouldUseShell,
    env: getSdkToolEnv(),
  });

  command.process.stdout?.on("data", () => {
    command.process.stdin?.write("y\n");
  });

  return command;
}
