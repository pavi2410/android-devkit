import { describe, expect, it, vi, beforeEach } from "vitest";

const { mocks, MockAdbClient } = vi.hoisted(() => {
  const m = {
    getDevices: vi.fn(),
    getDeviceName: vi.fn(),
    getApiLevel: vi.fn(),
    getAndroidVersion: vi.fn(),
    takeScreenshot: vi.fn(),
    reboot: vi.fn(),
    installApk: vi.fn(),
    uninstallPackage: vi.fn(),
    clearAppData: vi.fn(),
    launchApp: vi.fn(),
    forceStopApp: vi.fn(),
    pairDevice: vi.fn(),
    listMdnsServices: vi.fn(),
    isMdnsSupported: vi.fn(),
    enableTcpip: vi.fn(),
    listPackages: vi.fn(),
    getPidForPackage: vi.fn(),
    listFiles: vi.fn(),
    pullFile: vi.fn(),
    pushFile: vi.fn(),
    deleteFile: vi.fn(),
    resolveAdbPath: vi.fn().mockReturnValue("/usr/bin/adb"),
  };

  class Client {
    exec = vi.fn();
    shell = vi.fn();
    connect = vi.fn().mockResolvedValue("connected");
    disconnect = vi.fn().mockResolvedValue("disconnected");
    constructor(_opts?: any) {}
  }

  return { mocks: m, MockAdbClient: Client };
});

vi.mock("@android-devkit/adb", () => ({
  ...mocks,
  AdbClient: MockAdbClient,
}));

import { AdbService } from "../../src/services/adb";

function createMockSdkService() {
  return {
    getSdkPath: vi.fn().mockReturnValue("/mock/sdk"),
    onAvdsChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onSdkPackagesChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  } as any;
}

describe("AdbService", () => {
  let service: AdbService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdbService(createMockSdkService());
  });

  describe("getDevices", () => {
    it("enriches devices with name, apiLevel, androidVersion", async () => {
      mocks.getDevices.mockResolvedValue([
        { serial: "emulator-5554", state: "device", model: "sdk_phone", connectionType: "emulator", isEmulator: true },
      ]);
      mocks.getDeviceName.mockResolvedValue("Pixel 6");
      mocks.getApiLevel.mockResolvedValue(33);
      mocks.getAndroidVersion.mockResolvedValue("13");

      const devices = await service.getDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0]).toMatchObject({
        serial: "emulator-5554",
        name: "Pixel 6",
        apiLevel: 33,
        androidVersion: "13",
      });
    });

    it("falls back to basic info on error", async () => {
      mocks.getDevices.mockResolvedValue([
        { serial: "abc123", state: "device", model: "Nexus", connectionType: "usb", isEmulator: false },
      ]);
      mocks.getDeviceName.mockRejectedValue(new Error("timeout"));
      mocks.getApiLevel.mockRejectedValue(new Error("timeout"));
      mocks.getAndroidVersion.mockRejectedValue(new Error("timeout"));

      const devices = await service.getDevices();

      expect(devices[0]).toMatchObject({
        name: "Nexus",
        apiLevel: 0,
        androidVersion: "Unknown",
      });
    });

    it("uses serial as name when model is missing for non-ready devices", async () => {
      mocks.getDevices.mockResolvedValue([
        { serial: "abc123", state: "offline", model: undefined, connectionType: "usb", isEmulator: false },
      ]);

      const devices = await service.getDevices();

      expect(devices[0].name).toBe("abc123");
      expect(devices[0].apiLevel).toBe(0);
    });
  });

  describe("connectWireless", () => {
    it("fires onDevicesChanged after connect", async () => {
      const listener = vi.fn();
      service.onDevicesChanged(listener);

      await service.connectWireless("192.168.1.100");

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("takeScreenshot", () => {
    it("generates timestamped path", async () => {
      mocks.takeScreenshot.mockResolvedValue(undefined);

      const path = await service.takeScreenshot("serial-1");

      expect(path).toMatch(/screenshot-.*\.png$/);
      expect(mocks.takeScreenshot).toHaveBeenCalled();
    });
  });

  describe("uninstallPackage", () => {
    it("delegates to adb uninstallPackage", async () => {
      mocks.uninstallPackage.mockResolvedValue(undefined);

      await service.uninstallPackage("serial-1", "com.example.app");

      expect(mocks.uninstallPackage).toHaveBeenCalledWith(
        expect.anything(),
        "serial-1",
        "com.example.app"
      );
    });
  });

  describe("clearAppData", () => {
    it("delegates to adb clearAppData", async () => {
      mocks.clearAppData.mockResolvedValue(undefined);

      await service.clearAppData("serial-1", "com.example.app");

      expect(mocks.clearAppData).toHaveBeenCalledWith(
        expect.anything(),
        "serial-1",
        "com.example.app"
      );
    });
  });

  describe("dispose", () => {
    it("disposes the EventEmitter", () => {
      const listener = vi.fn();
      service.onDevicesChanged(listener);

      service.dispose();

      expect(listener).not.toHaveBeenCalled();
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
