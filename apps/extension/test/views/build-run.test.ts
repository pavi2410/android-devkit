import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getBuildVariants: vi.fn(),
}));

vi.mock("@android-devkit/gradle", () => ({}));

import { BuildRunProvider } from "../../src/views/build-run";
import { createMockExtensionContext } from "../helpers/mock-context";

function createMockGradleService() {
  return {
    getBuildVariants: mocks.getBuildVariants.mockResolvedValue([]),
    listTasks: vi.fn().mockResolvedValue([]),
    runTask: vi.fn(),
    findApk: vi.fn(),
    getProjectFolder: vi.fn().mockReturnValue("/mock/project"),
  } as any;
}

function createMockAdbService() {
  return {
    getDevices: vi.fn().mockResolvedValue([]),
    onDevicesChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  } as any;
}

describe("BuildRunProvider", () => {
  let provider: BuildRunProvider;
  let context: ReturnType<typeof createMockExtensionContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createMockExtensionContext();
    provider = new BuildRunProvider(
      createMockGradleService(),
      createMockAdbService(),
      context as any
    );
  });

  describe("variant persistence", () => {
    it("starts with no variant selected", () => {
      expect(provider.getSelectedVariant()).toBeUndefined();
    });

    it("persists variant to workspaceState", async () => {
      const variant = { name: "debug", assembleTask: "assembleDebug" };
      await provider.setVariant(variant);

      expect(provider.getSelectedVariant()).toEqual(variant);
      expect(context.workspaceState.update).toHaveBeenCalledWith("buildRun.variant", variant);
    });
  });

  describe("device persistence", () => {
    it("starts with no device selected", () => {
      expect(provider.getSelectedDeviceSerial()).toBeUndefined();
      expect(provider.getSelectedDeviceLabel()).toBeUndefined();
    });

    it("persists device to workspaceState", async () => {
      await provider.setDevice("emulator-5554", "Pixel 6 (emulator-5554)");

      expect(provider.getSelectedDeviceSerial()).toBe("emulator-5554");
      expect(provider.getSelectedDeviceLabel()).toBe("Pixel 6 (emulator-5554)");
      expect(context.workspaceState.update).toHaveBeenCalledWith("buildRun.deviceSerial", "emulator-5554");
      expect(context.workspaceState.update).toHaveBeenCalledWith("buildRun.deviceLabel", "Pixel 6 (emulator-5554)");
    });
  });

  describe("selection change events", () => {
    it("fires on variant change", async () => {
      const listener = vi.fn();
      provider.onDidSelectionChange(listener);

      await provider.setVariant({ name: "release", assembleTask: "assembleRelease" });

      expect(listener).toHaveBeenCalled();
    });

    it("fires on device change", async () => {
      const listener = vi.fn();
      provider.onDidSelectionChange(listener);

      await provider.setDevice("serial", "label");

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("getChildren", () => {
    it("returns correct tree items", async () => {
      const children = await provider.getChildren();

      expect(children.length).toBe(6);
      expect(children[0].label).toBe("Build Variant");
      expect(children[0].description).toBe("Not selected");
      expect(children[1].label).toBe("Target Device");
      expect(children[1].description).toBe("Not selected");
    });

    it("shows selected variant and device", async () => {
      await provider.setVariant({ name: "debug", assembleTask: "assembleDebug" });
      await provider.setDevice("emu-5554", "Pixel 6");

      const children = await provider.getChildren();

      expect(children[0].description).toBe("debug");
      expect(children[1].description).toBe("Pixel 6");
    });
  });

  describe("dispose", () => {
    it("disposes both EventEmitters", () => {
      expect(() => provider.dispose()).not.toThrow();
    });
  });
});
