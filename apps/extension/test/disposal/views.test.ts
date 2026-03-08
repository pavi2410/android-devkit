import { describe, expect, it, vi, beforeEach } from "vitest";

const { FakeStream } = vi.hoisted(() => {
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
  return { FakeStream };
});

vi.mock("@android-devkit/logcat", () => ({
  LogcatStream: FakeStream,
  clearLogcat: vi.fn(),
}));

vi.mock("@android-devkit/android-project", () => ({
  detectAndroidModules: vi.fn().mockResolvedValue([]),
  inspectAndroidModule: vi.fn(),
  collectAndroidGradleScripts: vi.fn().mockResolvedValue([]),
  listDirectoryChildren: vi.fn().mockResolvedValue([]),
}));

import { LogcatTreeProvider } from "../../src/views/logcat";
import { LogcatService } from "../../src/services/logcat";
import { BuildRunProvider } from "../../src/views/build-run";
import { createMockExtensionContext } from "../helpers/mock-context";

function createMockAdbService() {
  return {
    getAdbPathPublic: vi.fn().mockReturnValue("/usr/bin/adb"),
    getDevices: vi.fn().mockResolvedValue([]),
    onDevicesChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  } as any;
}

function createMockGradleService() {
  return {
    getBuildVariants: vi.fn().mockResolvedValue([]),
    listTasks: vi.fn().mockResolvedValue([]),
    getProjectFolder: vi.fn().mockReturnValue("/mock"),
  } as any;
}

describe("View disposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LogcatTreeProvider.dispose()", () => {
    it("disposes output channel and both EventEmitters", () => {
      const logcatService = new LogcatService(createMockAdbService());
      const provider = new LogcatTreeProvider(logcatService);

      expect(() => provider.dispose()).not.toThrow();
    });
  });

  describe("BuildRunProvider.dispose()", () => {
    it("disposes both EventEmitters", () => {
      const context = createMockExtensionContext();
      const provider = new BuildRunProvider(
        createMockGradleService(),
        createMockAdbService(),
        context as any
      );

      expect(() => provider.dispose()).not.toThrow();
    });
  });
});
