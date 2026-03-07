import * as vscode from "vscode";
import * as path from "node:path";
import { getSdkToolDirectories } from "@android-devkit/android-sdk";
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
  return getSdkToolDirectories(sdkPath);
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
