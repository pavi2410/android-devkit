import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getCommandLineToolsBinPath,
  getSdkToolDirectories,
  resolveAndroidSdkPath,
  resolveCommandLineToolPath,
  resolveEmulatorToolPath,
  resolvePlatformToolPath,
} from "../src/index.js";

describe("@android-devkit/android-sdk", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prefers an explicitly configured SDK path", () => {
    const dir = mkdtempSync(join(tmpdir(), "android-sdk-"));
    tempDirs.push(dir);

    expect(resolveAndroidSdkPath({ configuredPath: dir })).toBe(dir);
  });

  it("falls back to environment SDK paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "android-sdk-"));
    tempDirs.push(dir);

    expect(resolveAndroidSdkPath({ env: { ANDROID_HOME: dir } })).toBe(dir);
  });

  it("resolves cmdline-tools latest bin and executable paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "android-sdk-"));
    tempDirs.push(dir);

    const ext = process.platform === "win32" ? ".bat" : "";
    const latestBin = join(dir, "cmdline-tools", "latest", "bin");
    mkdirSync(latestBin, { recursive: true });
    writeFileSync(join(latestBin, `sdkmanager${ext}`), "");

    expect(getCommandLineToolsBinPath(dir)).toBe(latestBin);
    expect(resolveCommandLineToolPath(dir, "sdkmanager")).toBe(join(latestBin, `sdkmanager${ext}`));
  });

  it("resolves platform and emulator tool paths and enumerates SDK tool dirs", () => {
    const dir = mkdtempSync(join(tmpdir(), "android-sdk-"));
    tempDirs.push(dir);

    const binaryExt = process.platform === "win32" ? ".exe" : "";
    const latestBin = join(dir, "cmdline-tools", "latest", "bin");
    const platformToolsDir = join(dir, "platform-tools");
    const emulatorDir = join(dir, "emulator");

    mkdirSync(latestBin, { recursive: true });
    mkdirSync(platformToolsDir, { recursive: true });
    mkdirSync(emulatorDir, { recursive: true });

    writeFileSync(join(platformToolsDir, `adb${binaryExt}`), "");
    writeFileSync(join(emulatorDir, `emulator${binaryExt}`), "");

    expect(resolvePlatformToolPath(dir, "adb")).toBe(join(platformToolsDir, `adb${binaryExt}`));
    expect(resolveEmulatorToolPath(dir, "emulator")).toBe(join(emulatorDir, `emulator${binaryExt}`));
    expect(getSdkToolDirectories(dir)).toEqual([platformToolsDir, emulatorDir, latestBin]);
  });
});
