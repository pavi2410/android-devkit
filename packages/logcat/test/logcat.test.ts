import { afterEach, describe, expect, it, vi } from "vitest";
import { AndroidLogPriority } from "@yume-chan/android-bin";

import { LogcatStream, clearLogcat, getLogcat } from "../src/index.js";

/**
 * Helper: create a fake Logcat instance with mocked binary() and clear() methods.
 */
function createFakeLogcat(options?: {
  entries?: Array<{ priority: number; tag: string; message: string; pid?: number; tid?: number; seconds?: number; nanoseconds?: number }>;
}) {
  const entries = options?.entries ?? [];

  const fakeLogcat = {
    binary: vi.fn((_opts?: unknown) => {
      return new ReadableStream({
        start(controller) {
          for (const e of entries) {
            controller.enqueue({
              priority: e.priority,
              tag: e.tag,
              message: e.message,
              pid: e.pid ?? 1234,
              tid: e.tid ?? 5678,
              seconds: e.seconds ?? 1704877200,
              nanoseconds: e.nanoseconds ?? 789000000,
              get timestamp() {
                return BigInt(this.seconds) * BigInt(1e9) + BigInt(this.nanoseconds);
              },
              payloadSize: 0,
              headerSize: 0,
              logId: 0,
              uid: 0,
              toString: () => "",
            });
          }
          controller.close();
        },
      });
    }),
    clear: vi.fn(async () => {}),
  };

  return fakeLogcat;
}

describe("logcat package", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts a logcat stream and receives entries", async () => {
    const logcat = createFakeLogcat({
      entries: [
        { priority: AndroidLogPriority.Debug, tag: "MyTag", message: "Hello world" },
      ],
    });

    const stream = new LogcatStream(logcat as any, { minLevel: "V" });
    const entries: Array<{ tag: string; message: string; level: string }> = [];

    stream.on("entry", (entry) => {
      entries.push({ tag: entry.tag, message: entry.message, level: entry.level });
    });

    const closePromise = new Promise<void>((resolve) => stream.on("close", resolve));
    stream.start();
    await closePromise;

    expect(logcat.binary).toHaveBeenCalled();
    expect(entries).toEqual([{ tag: "MyTag", message: "Hello world", level: "D" }]);
  });

  it("filters out entries below the configured minimum level", async () => {
    const logcat = createFakeLogcat({
      entries: [
        { priority: AndroidLogPriority.Debug, tag: "MyTag", message: "Debug message" },
        { priority: AndroidLogPriority.Error, tag: "MyTag", message: "Error message" },
      ],
    });

    const stream = new LogcatStream(logcat as any, { minLevel: "E" });
    const levels: string[] = [];

    stream.on("entry", (entry) => {
      levels.push(entry.level);
    });

    const closePromise = new Promise<void>((resolve) => stream.on("close", resolve));
    stream.start();
    await closePromise;

    expect(levels).toEqual(["E"]);
  });

  it("stops an active stream", async () => {
    // Create a stream that never closes naturally
    const logcat = {
      binary: vi.fn(() => {
        return new ReadableStream({
          start() {
            // Don't close — simulate an open stream
          },
          cancel() {
            // Allow cancellation
          },
        });
      }),
      clear: vi.fn(async () => {}),
    };

    const stream = new LogcatStream(logcat as any);
    stream.start();
    expect(stream.isRunning).toBe(true);

    stream.stop();
    expect(stream.isRunning).toBe(false);
  });

  it("clears logcat buffers", async () => {
    const logcat = createFakeLogcat();
    await clearLogcat(logcat as any);
    expect(logcat.clear).toHaveBeenCalled();
  });

  it("reads buffered logcat output with getLogcat", async () => {
    const logcat = createFakeLogcat({
      entries: [
        { priority: AndroidLogPriority.Info, tag: "TestTag", message: "line one" },
        { priority: AndroidLogPriority.Warn, tag: "TestTag", message: "line two" },
      ],
    });

    const entries = await getLogcat(logcat as any, 25);

    expect(logcat.binary).toHaveBeenCalledWith({ dump: true, tail: 25 });
    expect(entries).toHaveLength(2);
    expect(entries[0].tag).toBe("TestTag");
    expect(entries[0].message).toBe("line one");
    expect(entries[0].level).toBe("I");
    expect(entries[1].message).toBe("line two");
    expect(entries[1].level).toBe("W");
  });

  it("maps AndroidLogPriority to LogLevel correctly", async () => {
    const logcat = createFakeLogcat({
      entries: [
        { priority: AndroidLogPriority.Verbose, tag: "T", message: "" },
        { priority: AndroidLogPriority.Debug, tag: "T", message: "" },
        { priority: AndroidLogPriority.Info, tag: "T", message: "" },
        { priority: AndroidLogPriority.Warn, tag: "T", message: "" },
        { priority: AndroidLogPriority.Error, tag: "T", message: "" },
        { priority: AndroidLogPriority.Fatal, tag: "T", message: "" },
      ],
    });

    const entries = await getLogcat(logcat as any);
    const levels = entries.map((e) => e.level);
    expect(levels).toEqual(["V", "D", "I", "W", "E", "F"]);
  });

  it("converts timestamp from nanoseconds to Date", async () => {
    const logcat = createFakeLogcat({
      entries: [
        { priority: AndroidLogPriority.Info, tag: "T", message: "", seconds: 1704877200, nanoseconds: 500000000 },
      ],
    });

    const entries = await getLogcat(logcat as any);
    const expectedMs = 1704877200 * 1000 + 500;
    expect(entries[0].timestamp.getTime()).toBe(expectedMs);
  });

  it("passes pid option to binary()", async () => {
    const logcat = createFakeLogcat({ entries: [] });
    const stream = new LogcatStream(logcat as any, { pid: 42 });

    const closePromise = new Promise<void>((resolve) => stream.on("close", resolve));
    stream.start();
    await closePromise;

    expect(logcat.binary).toHaveBeenCalledWith({ pid: 42 });
  });
});
