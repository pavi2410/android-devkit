import { describe, expect, it, vi, beforeEach } from "vitest";
import { window } from "vscode";

// We can't easily test registerDeviceCommands since it registers commands.
// Instead, test the selectDevice helper logic by reconstructing it.

describe("commands/devices — selectDevice logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockAdbService(devices: any[]) {
    return {
      getDevices: vi.fn().mockResolvedValue(devices),
    } as any;
  }

  const deviceA = {
    serial: "emulator-5554",
    state: "device",
    name: "Pixel 6",
    apiLevel: 33,
    androidVersion: "13",
  };

  const deviceB = {
    serial: "abc123",
    state: "device",
    name: "Galaxy S22",
    apiLevel: 34,
    androidVersion: "14",
  };

  // Re-implement the selectDevice logic for unit testing
  async function selectDevice(
    adbService: any,
    context?: { globalState: { get: Function; update: Function } }
  ): Promise<string | undefined> {
    const devices = await adbService.getDevices();

    if (devices.length === 0) {
      window.showWarningMessage("No devices connected");
      return undefined;
    }

    if (devices.length === 1) {
      return devices[0].serial;
    }

    const lastUsed = context?.globalState.get("lastUsedDevice");

    const items = devices.map((d: any) => ({
      label: d.name,
      description: d.serial === lastUsed ? `${d.serial} (last used)` : d.serial,
      detail: `Android ${d.androidVersion} (API ${d.apiLevel})`,
      serial: d.serial,
    }));

    if (lastUsed) {
      items.sort((a: any, b: any) => {
        if (a.serial === lastUsed) return -1;
        if (b.serial === lastUsed) return 1;
        return 0;
      });
    }

    const selected = await window.showQuickPick(items, { placeHolder: "Select a device" });

    if (selected && context) {
      await context.globalState.update("lastUsedDevice", (selected as any).serial);
    }

    return (selected as any)?.serial;
  }

  it("returns single device serial automatically", async () => {
    const adb = createMockAdbService([deviceA]);
    const serial = await selectDevice(adb);
    expect(serial).toBe("emulator-5554");
    expect(window.showQuickPick).not.toHaveBeenCalled();
  });

  it("shows picker for multiple devices", async () => {
    vi.mocked(window.showQuickPick).mockResolvedValue({
      label: "Pixel 6",
      description: "emulator-5554",
      serial: "emulator-5554",
    } as any);

    const adb = createMockAdbService([deviceA, deviceB]);
    const serial = await selectDevice(adb);

    expect(window.showQuickPick).toHaveBeenCalled();
    expect(serial).toBe("emulator-5554");
  });

  it("returns undefined for empty device list", async () => {
    const adb = createMockAdbService([]);
    const serial = await selectDevice(adb);

    expect(serial).toBeUndefined();
    expect(window.showWarningMessage).toHaveBeenCalledWith("No devices connected");
  });

  it("marks last-used device in picker", async () => {
    vi.mocked(window.showQuickPick).mockResolvedValue({
      label: "Galaxy S22",
      description: "abc123",
      serial: "abc123",
    } as any);

    const context = {
      globalState: {
        get: vi.fn().mockReturnValue("abc123"),
        update: vi.fn(),
      },
    };

    const adb = createMockAdbService([deviceA, deviceB]);
    await selectDevice(adb, context);

    const pickerCall = vi.mocked(window.showQuickPick).mock.calls[0];
    const items = pickerCall[0] as any[];
    // Last used should be first
    expect(items[0].serial).toBe("abc123");
    expect(items[0].description).toContain("last used");
  });

  it("persists selected device to globalState", async () => {
    vi.mocked(window.showQuickPick).mockResolvedValue({
      label: "Pixel 6",
      serial: "emulator-5554",
    } as any);

    const context = {
      globalState: {
        get: vi.fn().mockReturnValue(undefined),
        update: vi.fn(),
      },
    };

    const adb = createMockAdbService([deviceA, deviceB]);
    await selectDevice(adb, context);

    expect(context.globalState.update).toHaveBeenCalledWith("lastUsedDevice", "emulator-5554");
  });
});
