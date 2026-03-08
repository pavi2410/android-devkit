import { describe, expect, it, vi, beforeEach } from "vitest";
import * as path from "node:path";

const mocks = vi.hoisted(() => ({
  getSdkToolDirectories: vi.fn(),
}));

vi.mock("@android-devkit/android-sdk", () => ({
  getSdkToolDirectories: mocks.getSdkToolDirectories,
}));

import { getSdkToolDirs, applyTerminalEnv } from "../../src/services/terminal-env";

function createMockSdkService(sdkPath?: string) {
  return {
    getSdkPath: vi.fn().mockReturnValue(sdkPath),
  } as any;
}

function createMockCollection() {
  return {
    clear: vi.fn(),
    prepend: vi.fn(),
    replace: vi.fn(),
    append: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    forEach: vi.fn(),
    description: undefined as any,
  };
}

describe("terminal-env", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSdkToolDirs", () => {
    it("returns directories from SDK", () => {
      mocks.getSdkToolDirectories.mockReturnValue([
        "/sdk/platform-tools",
        "/sdk/tools",
        "/sdk/build-tools/33.0.0",
      ]);

      const dirs = getSdkToolDirs("/sdk");

      expect(dirs).toEqual([
        "/sdk/platform-tools",
        "/sdk/tools",
        "/sdk/build-tools/33.0.0",
      ]);
    });
  });

  describe("applyTerminalEnv", () => {
    it("prepends SDK tool dirs to PATH", () => {
      mocks.getSdkToolDirectories.mockReturnValue([
        "/sdk/platform-tools",
        "/sdk/cmdline-tools/latest/bin",
      ]);

      const collection = createMockCollection();
      const count = applyTerminalEnv(collection as any, createMockSdkService("/sdk"));

      expect(count).toBe(2);
      expect(collection.clear).toHaveBeenCalled();
      expect(collection.prepend).toHaveBeenCalledWith(
        "PATH",
        `/sdk/platform-tools${path.delimiter}/sdk/cmdline-tools/latest/bin${path.delimiter}`
      );
    });

    it("returns 0 when no SDK path", () => {
      const collection = createMockCollection();
      const count = applyTerminalEnv(collection as any, createMockSdkService(undefined));

      expect(count).toBe(0);
      expect(collection.clear).toHaveBeenCalled();
      expect(collection.prepend).not.toHaveBeenCalled();
    });

    it("returns 0 when no tool dirs found", () => {
      mocks.getSdkToolDirectories.mockReturnValue([]);

      const collection = createMockCollection();
      const count = applyTerminalEnv(collection as any, createMockSdkService("/sdk"));

      expect(count).toBe(0);
    });

    it("sets description with SDK info", () => {
      mocks.getSdkToolDirectories.mockReturnValue(["/sdk/platform-tools"]);

      const collection = createMockCollection();
      applyTerminalEnv(collection as any, createMockSdkService("/sdk"));

      expect(collection.description).toBeDefined();
      expect(collection.description.value).toContain("/sdk");
    });
  });
});
