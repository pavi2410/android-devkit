import * as fs from "node:fs";
import * as path from "node:path";
import { spawnCommand } from "@android-devkit/tool-core";

export function getEmulatorPath(sdkPath: string): string | undefined {
  const ext = process.platform === "win32" ? ".exe" : "";
  const emulatorPath = path.join(sdkPath, "emulator", `emulator${ext}`);
  return fs.existsSync(emulatorPath) ? emulatorPath : undefined;
}

export function launchAvd(sdkPath: string, name: string): void {
  const emulatorPath = getEmulatorPath(sdkPath);
  if (!emulatorPath) {
    throw new Error(`emulator not found in SDK at: ${sdkPath}`);
  }

  const proc = spawnCommand({
    command: emulatorPath,
    args: ["-avd", name],
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ANDROID_SDK_ROOT: sdkPath },
  });

  proc.unref();
}

export function wipeAvdData(sdkPath: string, name: string): void {
  const emulatorPath = getEmulatorPath(sdkPath);
  if (!emulatorPath) {
    throw new Error(`emulator not found in SDK at: ${sdkPath}`);
  }

  const proc = spawnCommand({
    command: emulatorPath,
    args: ["-avd", name, "-wipe-data", "-no-window"],
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ANDROID_SDK_ROOT: sdkPath },
  });

  proc.unref();
}
