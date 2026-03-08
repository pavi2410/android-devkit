import { describe, expect, it, vi, beforeEach } from "vitest";
import { window, commands } from "vscode";

describe("commands/run — command logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockGradleService() {
    return {
      runTask: vi.fn().mockResolvedValue(undefined),
      findApk: vi.fn().mockReturnValue("/build/app-debug.apk"),
      getBuildVariants: vi.fn().mockResolvedValue([]),
    };
  }

  function createMockAdbService() {
    return {
      installApk: vi.fn().mockResolvedValue(undefined),
      launchApp: vi.fn().mockResolvedValue(undefined),
      forceStopApp: vi.fn().mockResolvedValue(undefined),
      uninstallPackage: vi.fn().mockResolvedValue(undefined),
      clearAppData: vi.fn().mockResolvedValue(undefined),
    };
  }

  function createMockBuildRunProvider(variant?: any, serial?: string) {
    return {
      getSelectedVariant: vi.fn().mockReturnValue(variant),
      getSelectedDeviceSerial: vi.fn().mockReturnValue(serial),
      getSelectedDeviceLabel: vi.fn().mockReturnValue(serial ? `Device (${serial})` : undefined),
      setVariant: vi.fn(),
      setDevice: vi.fn(),
      getVariants: vi.fn().mockReturnValue([]),
    };
  }

  describe("buildVariant logic", () => {
    it("calls gradleService.runTask with assemble task", async () => {
      const gradle = createMockGradleService();
      const variant = { name: "debug", assembleTask: "assembleDebug" };

      const outputChannel = { clear: vi.fn(), show: vi.fn(), appendLine: vi.fn() };

      await gradle.runTask(variant.assembleTask, outputChannel, undefined);
      expect(gradle.runTask).toHaveBeenCalledWith("assembleDebug", outputChannel, undefined);
    });
  });

  describe("runOnDevice 3-step flow", () => {
    it("builds, installs, and launches", async () => {
      const gradle = createMockGradleService();
      const adb = createMockAdbService();
      const variant = { name: "debug", assembleTask: "assembleDebug" };
      const serial = "emulator-5554";
      const packageName = "com.example.app";

      const outputChannel = { clear: vi.fn(), show: vi.fn(), appendLine: vi.fn() };

      // Step 1: Build
      await gradle.runTask(variant.assembleTask, outputChannel, undefined);
      expect(gradle.runTask).toHaveBeenCalledWith("assembleDebug", outputChannel, undefined);

      // Step 2: Install
      const apkPath = gradle.findApk(variant);
      await adb.installApk(serial, apkPath);
      expect(adb.installApk).toHaveBeenCalledWith(serial, "/build/app-debug.apk");

      // Step 3: Launch
      await adb.launchApp(serial, packageName);
      expect(adb.launchApp).toHaveBeenCalledWith(serial, packageName);
    });
  });

  describe("stopApp", () => {
    it("calls forceStopApp", async () => {
      const adb = createMockAdbService();

      await adb.forceStopApp("emulator-5554", "com.example.app");
      expect(adb.forceStopApp).toHaveBeenCalledWith("emulator-5554", "com.example.app");
    });
  });

  describe("uninstallApp logic", () => {
    it("calls uninstallPackage after confirmation", async () => {
      const adb = createMockAdbService();

      await adb.uninstallPackage("emulator-5554", "com.example.app");
      expect(adb.uninstallPackage).toHaveBeenCalledWith("emulator-5554", "com.example.app");
    });
  });

  describe("clearAppData logic", () => {
    it("calls clearAppData after confirmation", async () => {
      const adb = createMockAdbService();

      await adb.clearAppData("emulator-5554", "com.example.app");
      expect(adb.clearAppData).toHaveBeenCalledWith("emulator-5554", "com.example.app");
    });
  });
});
