import { resolveEmulatorToolPath } from "@android-devkit/android-sdk";
import { spawnCommand } from "@android-devkit/tool-core";

export function getEmulatorPath(sdkPath: string): string | undefined {
  return resolveEmulatorToolPath(sdkPath, "emulator");
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
