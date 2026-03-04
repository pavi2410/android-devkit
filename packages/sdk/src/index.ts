import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import type { SdkPackage, SdkPackageCategory } from "./types.js";

export type { SdkPackage, SdkPackageCategory };

const execFileAsync = promisify(execFile);

/**
 * Resolve the sdkmanager executable path from the SDK root.
 * Checks cmdline-tools/latest first, then falls back to any installed version.
 */
export function getSdkManagerPath(sdkPath: string): string | undefined {
  const ext = process.platform === "win32" ? ".bat" : "";
  const latestPath = path.join(sdkPath, "cmdline-tools", "latest", "bin", `sdkmanager${ext}`);
  if (fs.existsSync(latestPath)) return latestPath;

  // Fallback: find any version under cmdline-tools/*/bin/sdkmanager
  const cmdlineToolsDir = path.join(sdkPath, "cmdline-tools");
  if (!fs.existsSync(cmdlineToolsDir)) return undefined;

  const entries = fs.readdirSync(cmdlineToolsDir);
  for (const entry of entries) {
    if (entry === "latest") continue;
    const candidate = path.join(cmdlineToolsDir, entry, "bin", `sdkmanager${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return undefined;
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

/**
 * Parse sdkmanager --list output into SdkPackage[].
 * The output format has two sections separated by a dashed line:
 *   Installed packages: and Available packages:
 */
export function parseSdkManagerList(output: string): SdkPackage[] {
  const packages: SdkPackage[] = [];
  const seen = new Set<string>();

  let inInstalled = false;
  let inAvailable = false;
  let pastHeader = false;

  for (const line of output.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("Installed packages:")) {
      inInstalled = true;
      inAvailable = false;
      pastHeader = false;
      continue;
    }
    if (trimmed.startsWith("Available packages:") || trimmed.startsWith("Available Updates:")) {
      inInstalled = false;
      inAvailable = true;
      pastHeader = false;
      continue;
    }

    // Skip column header line (Path | Version | Description | Location)
    if (!pastHeader && trimmed.startsWith("Path")) {
      pastHeader = true;
      continue;
    }
    // Skip separator line
    if (trimmed.startsWith("---") || trimmed === "") continue;

    if (!inInstalled && !inAvailable) continue;

    // Each package line: "  id  |  version  |  description  |  location?"
    const cols = line.split("|").map((c) => c.trim());
    if (cols.length < 2) continue;

    const id = cols[0];
    const version = cols[1] ?? "";
    const description = cols[2] ?? "";

    if (!id || id.includes(" ")) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    packages.push({
      id,
      displayName: parseDisplayName(id, description),
      version,
      installed: inInstalled,
      category: detectCategory(id),
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

  const { stdout } = await execFileAsync(sdkManagerPath, ["--list", "--include_obsolete"], {
    timeout: 60000,
    env: { ...process.env, JAVA_OPTS: "-Dfile.encoding=UTF-8" },
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
): ReturnType<typeof spawn> {
  const sdkManagerPath = getSdkManagerPath(sdkPath);
  if (!sdkManagerPath) {
    throw new Error(`sdkmanager not found in SDK at: ${sdkPath}`);
  }

  const proc = spawn(sdkManagerPath, ["--install", id], {
    env: { ...process.env, JAVA_OPTS: "-Dfile.encoding=UTF-8" },
  });

  // Automatically accept all license prompts
  const acceptLicenses = () => {
    proc.stdin.write("y\n");
  };
  proc.stdout.on("data", acceptLicenses);

  return proc;
}

/**
 * Uninstall an SDK package by id.
 */
export async function uninstallSdkPackage(sdkPath: string, id: string): Promise<void> {
  const sdkManagerPath = getSdkManagerPath(sdkPath);
  if (!sdkManagerPath) {
    throw new Error(`sdkmanager not found in SDK at: ${sdkPath}`);
  }

  await execFileAsync(sdkManagerPath, ["--uninstall", id], {
    timeout: 60000,
    env: { ...process.env, JAVA_OPTS: "-Dfile.encoding=UTF-8" },
  });
}

/**
 * Update all installed SDK packages.
 */
export function updateAllSdkPackages(sdkPath: string): ReturnType<typeof spawn> {
  const sdkManagerPath = getSdkManagerPath(sdkPath);
  if (!sdkManagerPath) {
    throw new Error(`sdkmanager not found in SDK at: ${sdkPath}`);
  }

  const proc = spawn(sdkManagerPath, ["--update"], {
    env: { ...process.env, JAVA_OPTS: "-Dfile.encoding=UTF-8" },
  });

  proc.stdout.on("data", () => {
    proc.stdin.write("y\n");
  });

  return proc;
}

