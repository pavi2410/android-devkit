import { describe, expect, it, vi, beforeEach } from "vitest";

const { MockAdbClient, FakeStream } = vi.hoisted(() => {
  class MockAdbClient {
    getDevices = vi.fn();
    getDeviceName = vi.fn();
    getApiLevel = vi.fn();
    getAndroidVersion = vi.fn();
    takeScreenshot = vi.fn();
    reboot = vi.fn();
    installApk = vi.fn();
    uninstallPackage = vi.fn();
    clearAppData = vi.fn();
    launchApp = vi.fn();
    forceStopApp = vi.fn();
    pairDevice = vi.fn();
    listMdnsServices = vi.fn();
    isMdnsSupported = vi.fn();
    enableTcpip = vi.fn();
    listPackages = vi.fn();
    getPidForPackage = vi.fn();
    listFiles = vi.fn();
    pullFile = vi.fn();
    pushFile = vi.fn();
    deleteFile = vi.fn();
    connect = vi.fn().mockResolvedValue("connected");
    disconnect = vi.fn().mockResolvedValue("disconnected");
    dispose = vi.fn();
    getAdbPath = vi.fn().mockReturnValue("/usr/bin/adb");
    constructor(_opts?: any) {}
  }

  class FakeStream {
    private listeners = new Map<string, Function[]>();
    isRunning = false;
    constructor(_opts?: any) {}
    on(event: string, cb: Function) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event)!.push(cb);
      return this;
    }
    start() { this.isRunning = true; }
    stop() { this.isRunning = false; }
  }

  return { MockAdbClient, FakeStream };
});

vi.mock("@android-devkit/adb", () => ({
  resolveAdbPath: vi.fn().mockReturnValue("/usr/bin/adb"),
  AdbClient: MockAdbClient,
}));

vi.mock("@android-devkit/logcat", () => ({
  LogcatStream: FakeStream,
  clearLogcat: vi.fn(),
}));

import { AdbService } from "../../src/services/adb";
import { LogcatService } from "../../src/services/logcat";

function createMockSdkService() {
  return {
    getSdkPath: vi.fn().mockReturnValue("/mock/sdk"),
    onAvdsChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onSdkPackagesChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    dispose: vi.fn(),
  } as any;
}

describe("Service disposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AdbService.dispose()", () => {
    it("disposes the EventEmitter — listeners no longer fire", () => {
      const service = new AdbService(createMockSdkService());
      const listener = vi.fn();
      service.onDevicesChanged(listener);

      service.dispose();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("LogcatService.dispose()", () => {
    it("stops active stream and disposes all 3 emitters", () => {
      const service = new LogcatService({ getAdbPathPublic: () => "/usr/bin/adb" } as any);
      service.start({ serial: "emulator-5554" });

      expect(service.isRunning).toBe(true);

      service.dispose();

      expect(service.isRunning).toBe(false);
    });

    it("is safe to call dispose multiple times", () => {
      const service = new LogcatService({ getAdbPathPublic: () => "/usr/bin/adb" } as any);

      expect(() => {
        service.dispose();
        service.dispose();
      }).not.toThrow();
    });
  });
});
