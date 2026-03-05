import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import type { SdkService } from "./sdk";

/**
 * Returns the list of directories to prepend to PATH so that common
 * Android SDK command-line tools (adb, fastboot, sdkmanager, avdmanager,
 * emulator, apkanalyzer, lint, …) are accessible from any VS Code terminal
 * regardless of the shell's existing PATH configuration.
 *
 * Directories are only included when they actually exist on disk.
 */
export function getSdkToolDirs(sdkPath: string): string[] {
  const dirs: string[] = [];

  const platformTools = path.join(sdkPath, "platform-tools");
  if (fs.existsSync(platformTools)) dirs.push(platformTools);

  const emulatorDir = path.join(sdkPath, "emulator");
  if (fs.existsSync(emulatorDir)) dirs.push(emulatorDir);

  const cmdlineToolsRoot = path.join(sdkPath, "cmdline-tools");
  if (fs.existsSync(cmdlineToolsRoot)) {
    const latestBin = path.join(cmdlineToolsRoot, "latest", "bin");
    if (fs.existsSync(latestBin)) {
      dirs.push(latestBin);
    } else {
      const versions = fs.readdirSync(cmdlineToolsRoot).filter((e) => e !== "latest");
      for (const ver of versions) {
        const bin = path.join(cmdlineToolsRoot, ver, "bin");
        if (fs.existsSync(bin)) {
          dirs.push(bin);
          break;
        }
      }
    }
  }

  return dirs;
}

/**
 * Applies (or refreshes) the Android SDK tool directories onto the
 * VS Code terminal environment. Uses `EnvironmentVariableCollection` so
 * the change is reflected in all new terminals automatically.
 *
 * Returns the number of directories actually prepended, or 0 if the SDK
 * path could not be resolved.
 */
export function applyTerminalEnv(
  collection: vscode.EnvironmentVariableCollection,
  sdkService: SdkService
): number {
  collection.clear();

  const sdkPath = sdkService.getSdkPath();
  if (!sdkPath) return 0;

  const dirs = getSdkToolDirs(sdkPath);
  if (dirs.length === 0) return 0;

  const prepend = dirs.join(path.delimiter);
  collection.prepend("PATH", prepend + path.delimiter);

  collection.description = new vscode.MarkdownString(
    `Android SDK tools added to PATH from \`${sdkPath}\`:\n` +
      dirs.map((d) => `- \`${path.relative(sdkPath, d)}\``).join("\n")
  );

  return dirs.length;
}
