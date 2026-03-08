import { describe, expect, it, vi, beforeEach } from "vitest";
import { commands } from "vscode";
import { DevicesTreeProvider } from "../../src/views/devices";

function createMockAdbService(devices: any[] = []) {
  const listeners: Function[] = [];
  return {
    getDevices: vi.fn().mockResolvedValue(devices),
    onDevicesChanged: vi.fn().mockImplementation((cb: Function) => {
      listeners.push(cb);
      return { dispose: vi.fn() };
    }),
    _fireDevicesChanged: () => listeners.forEach((cb) => cb()),
  };
}

const deviceReady = {
  serial: "emulator-5554",
  state: "device",
  name: "Pixel 6",
  apiLevel: 33,
  androidVersion: "13",
  model: "sdk_phone",
  product: "sdk_phone",
  connectionType: "emulator" as const,
  isEmulator: true,
};

const deviceUsb = {
  serial: "abc123",
  state: "device",
  name: "Galaxy S22",
  apiLevel: 34,
  androidVersion: "14",
  model: "SM-S901B",
  product: "o1s",
  connectionType: "usb" as const,
  isEmulator: false,
};

const deviceOffline = {
  serial: "xyz789",
  state: "offline",
  name: "xyz789",
  apiLevel: 0,
  androidVersion: "Unknown",
  model: undefined,
  connectionType: "usb" as const,
  isEmulator: false,
};

describe("DevicesTreeProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getChildren (root)", () => {
    it("returns empty array when no devices", async () => {
      const adb = createMockAdbService([]);
      const provider = new DevicesTreeProvider(adb as any);

      const children = await provider.getChildren();
      expect(children).toHaveLength(0);
    });

    it("returns DeviceTreeItems for connected devices", async () => {
      const adb = createMockAdbService([deviceReady, deviceUsb]);
      const provider = new DevicesTreeProvider(adb as any);

      const children = await provider.getChildren();
      expect(children).toHaveLength(2);
    });
  });

  describe("device-to-TreeItem mapping", () => {
    it("emulator gets vm icon", async () => {
      const adb = createMockAdbService([deviceReady]);
      const provider = new DevicesTreeProvider(adb as any);

      const children = await provider.getChildren();
      const item = children[0];
      expect(item.iconPath).toMatchObject({ id: "vm" });
      expect(item.label).toBe("Pixel 6");
    });

    it("USB device gets device-mobile icon", async () => {
      const adb = createMockAdbService([deviceUsb]);
      const provider = new DevicesTreeProvider(adb as any);

      const children = await provider.getChildren();
      const item = children[0];
      expect(item.iconPath).toMatchObject({ id: "device-mobile" });
    });

    it("wireless device gets radio-tower icon", async () => {
      const wirelessDevice = { ...deviceUsb, connectionType: "wireless" as const };
      const adb = createMockAdbService([wirelessDevice]);
      const provider = new DevicesTreeProvider(adb as any);

      const children = await provider.getChildren();
      expect(children[0].iconPath).toMatchObject({ id: "radio-tower" });
    });

    it("tcpip device gets globe icon", async () => {
      const tcpDevice = { ...deviceUsb, connectionType: "tcpip" as const };
      const adb = createMockAdbService([tcpDevice]);
      const provider = new DevicesTreeProvider(adb as any);

      const children = await provider.getChildren();
      expect(children[0].iconPath).toMatchObject({ id: "globe" });
    });

    it("offline device gets warning icon", async () => {
      const adb = createMockAdbService([deviceOffline]);
      const provider = new DevicesTreeProvider(adb as any);

      const children = await provider.getChildren();
      expect(children[0].iconPath).toMatchObject({ id: "warning" });
      expect(children[0].description).toBe("offline");
    });
  });

  describe("device properties", () => {
    it("shows properties for ready devices", async () => {
      const adb = createMockAdbService([deviceReady]);
      const provider = new DevicesTreeProvider(adb as any);

      const devices = await provider.getChildren();
      const props = await provider.getChildren(devices[0]);

      const labels = props.map((p) => p.label);
      expect(labels).toContain("Android");
      expect(labels).toContain("API Level");
      expect(labels).toContain("Serial");
      expect(labels).toContain("Connection");
    });

    it("shows state and serial for non-ready devices", async () => {
      const adb = createMockAdbService([deviceOffline]);
      const provider = new DevicesTreeProvider(adb as any);

      const devices = await provider.getChildren();
      const props = await provider.getChildren(devices[0]);

      const labels = props.map((p) => p.label);
      expect(labels).toContain("State");
      expect(labels).toContain("Serial");
    });
  });

  describe("getDevice", () => {
    it("finds device by serial", async () => {
      const adb = createMockAdbService([deviceReady, deviceUsb]);
      const provider = new DevicesTreeProvider(adb as any);

      await provider.getChildren(); // populate internal cache
      expect(provider.getDevice("emulator-5554")).toEqual(deviceReady);
      expect(provider.getDevice("nonexistent")).toBeUndefined();
    });
  });
});
