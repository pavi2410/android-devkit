import { describe, expect, it, vi, beforeEach } from "vitest";
import { commands } from "vscode";
import type { LogcatEntry } from "@android-devkit/logcat";

const { FakeStream } = vi.hoisted(() => {
  let currentStream: any;

  class FakeStream {
    private listeners = new Map<string, Function[]>();
    isRunning = false;

    constructor(_opts?: any) {
      currentStream = this;
    }

    on(event: string, cb: Function) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event)!.push(cb);
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      for (const cb of this.listeners.get(event) ?? []) cb(...args);
    }

    start() { this.isRunning = true; }
    stop() { this.isRunning = false; }

    static getCurrent() { return currentStream; }
  }

  return { FakeStream };
});

vi.mock("@android-devkit/logcat", () => ({
  LogcatStream: FakeStream,
  clearLogcat: vi.fn(),
}));

import { LogcatTreeProvider } from "../../src/views/logcat";
import { LogcatService } from "../../src/services/logcat";

const fakeLogcatInstance = { binary: vi.fn(), clear: vi.fn() };

function createMockAdbService() {
  return {
    createLogcat: vi.fn().mockResolvedValue(fakeLogcatInstance),
  } as any;
}

const flushPromises = () => new Promise((r) => setTimeout(r, 0));

function makeEntry(overrides: Partial<LogcatEntry> = {}): LogcatEntry {
  return {
    timestamp: new Date("2024-01-15T12:00:00Z"),
    pid: 1234,
    tid: 5678,
    level: "I",
    tag: "TestTag",
    message: "Test message",
    ...overrides,
  };
}

describe("LogcatTreeProvider", () => {
  let provider: LogcatTreeProvider;
  let logcatService: LogcatService;

  beforeEach(() => {
    vi.clearAllMocks();
    logcatService = new LogcatService(createMockAdbService());
    provider = new LogcatTreeProvider(logcatService);
    provider.setHasAvailableDevices(true);
  });

  describe("state machine", () => {
    it("starts in stopped state", () => {
      expect(provider.getSessionState()).toBe("stopped");
    });

    it("transitions to running on start", () => {
      provider.start({ serial: "emulator-5554", minLevel: "I" });
      expect(provider.getSessionState()).toBe("running");
    });

    it("transitions to paused from running", () => {
      provider.start({ serial: "emulator-5554", minLevel: "I" });
      provider.pause();
      expect(provider.getSessionState()).toBe("paused");
    });

    it("transitions back to stopped from paused via stop", () => {
      provider.start({ serial: "emulator-5554", minLevel: "I" });
      provider.pause();
      provider.stop();
      expect(provider.getSessionState()).toBe("stopped");
    });

    it("pause is no-op when not running", () => {
      provider.pause();
      expect(provider.getSessionState()).toBe("stopped");
    });
  });

  describe("entry filtering", () => {
    it("filters entries below min level", async () => {
      provider.start({ serial: "s1", minLevel: "W" });
      await flushPromises();

      const stream = FakeStream.getCurrent();
      stream.emit("entry", makeEntry({ level: "D", message: "debug" }));
      stream.emit("entry", makeEntry({ level: "W", message: "warning" }));
      stream.emit("entry", makeEntry({ level: "E", message: "error" }));

      const entries = provider.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].level).toBe("W");
      expect(entries[1].level).toBe("E");
    });

    it("filters by text filter", async () => {
      provider.start({ serial: "s1", minLevel: "V" });
      await flushPromises();
      provider.setFilter("important");

      const stream = FakeStream.getCurrent();
      stream.emit("entry", makeEntry({ message: "not relevant" }));
      stream.emit("entry", makeEntry({ message: "very IMPORTANT stuff" }));
      stream.emit("entry", makeEntry({ tag: "important-tag", message: "other" }));

      expect(provider.getEntries()).toHaveLength(2);
    });

    it("filters by PID", async () => {
      provider.start({ serial: "s1", minLevel: "V", pid: 1234 });
      await flushPromises();

      const stream = FakeStream.getCurrent();
      stream.emit("entry", makeEntry({ pid: 1234, message: "correct" }));
      stream.emit("entry", makeEntry({ pid: 9999, message: "wrong pid" }));

      expect(provider.getEntries()).toHaveLength(1);
      expect(provider.getEntries()[0].message).toBe("correct");
    });
  });

  describe("max entries rotation", () => {
    it("rotates entries when exceeding max", async () => {
      (provider as any).maxEntries = 3;
      provider.start({ serial: "s1", minLevel: "V" });
      await flushPromises();

      const stream = FakeStream.getCurrent();
      for (let i = 0; i < 5; i++) {
        stream.emit("entry", makeEntry({ message: `msg-${i}` }));
      }

      const entries = provider.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].message).toBe("msg-2");
      expect(entries[2].message).toBe("msg-4");
    });
  });

  describe("getChildren", () => {
    it("returns empty when no devices available", async () => {
      provider.setHasAvailableDevices(false);
      const children = await provider.getChildren();
      expect(children).toHaveLength(0);
    });

    it("returns status and stats items when running", async () => {
      provider.start({ serial: "emulator-5554", minLevel: "I" });
      const children = await provider.getChildren();

      expect(children.length).toBeGreaterThanOrEqual(3);
      expect(children[0].label).toBe("Running");
    });

    it("shows filter item when filter is set", async () => {
      provider.start({ serial: "s1", minLevel: "I" });
      provider.setFilter("myfilter");
      const children = await provider.getChildren();

      const filterItem = children.find((c) => c.label === "Filter");
      expect(filterItem).toBeDefined();
      expect(filterItem!.description).toBe("myfilter");
    });

    it("shows package filter item", async () => {
      provider.start({ serial: "s1", minLevel: "I", packageName: "com.test", pid: 42 });
      const children = await provider.getChildren();

      const pkgItem = children.find((c) => c.label === "Package");
      expect(pkgItem).toBeDefined();
      expect(pkgItem!.description).toContain("com.test");
      expect(pkgItem!.description).toContain("42");
    });
  });

  describe("getEntries", () => {
    it("returns readonly array of entries", async () => {
      provider.start({ serial: "s1", minLevel: "V" });
      await flushPromises();
      FakeStream.getCurrent().emit("entry", makeEntry());

      const entries = provider.getEntries();
      expect(entries).toHaveLength(1);
    });
  });

  describe("formatEntry", () => {
    it("formats entry as a single line", () => {
      const entry = makeEntry({
        pid: 123,
        tid: 456,
        level: "W",
        tag: "MyApp",
        message: "Something happened",
      });

      const line = LogcatTreeProvider.formatEntry(entry);
      expect(line).toContain("123");
      expect(line).toContain("456");
      expect(line).toContain("W");
      expect(line).toContain("MyApp");
      expect(line).toContain("Something happened");
    });
  });

  describe("dispose", () => {
    it("disposes output channel and emitters", () => {
      provider.dispose();
      expect(() => provider.dispose()).not.toThrow();
    });
  });
});
