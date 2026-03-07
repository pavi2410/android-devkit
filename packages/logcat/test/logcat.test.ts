import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnCommandMock } = vi.hoisted(() => ({
  spawnCommandMock: vi.fn(),
}));

vi.mock("@android-devkit/tool-core", () => ({
  spawnCommand: spawnCommandMock,
}));

import { LogcatStream, clearLogcat, getLogcat } from "../src/index.js";

class FakeProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };
  kill = vi.fn();
}

describe("logcat package", () => {
  beforeEach(() => {
    spawnCommandMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts a logcat stream with serial and tag filters", () => {
    const proc = new FakeProcess();
    spawnCommandMock.mockReturnValue(proc);
    const stream = new LogcatStream({ adbPath: "adb-custom", serial: "emulator-5554", minLevel: "D", tags: ["MyTag"] });
    const entries: Array<{ tag: string; message: string }> = [];

    stream.on("entry", (entry) => {
      entries.push({ tag: entry.tag, message: entry.message });
    });

    stream.start();
    proc.stdout.emit("data", "01-10 12:34:56.789  1234  5678 D MyTag   : Hello world\n");

    expect(spawnCommandMock).toHaveBeenCalledWith({
      command: "adb-custom",
      args: ["-s", "emulator-5554", "logcat", "-v", "threadtime", "MyTag:D", "*:S"],
    });
    expect(entries).toEqual([{ tag: "MyTag", message: "Hello world" }]);
    expect(stream.isRunning).toBe(true);
  });

  it("filters out entries below the configured minimum level", () => {
    const proc = new FakeProcess();
    spawnCommandMock.mockReturnValue(proc);
    const stream = new LogcatStream({ minLevel: "E" });
    const levels: string[] = [];

    stream.on("entry", (entry) => {
      levels.push(entry.level);
    });

    stream.start();
    proc.stdout.emit("data", [
      "01-10 12:34:56.789  1234  5678 D MyTag   : Debug message",
      "01-10 12:34:57.789  1234  5678 E MyTag   : Error message",
      "",
    ].join("\n"));

    expect(levels).toEqual(["E"]);
  });

  it("handles chunked stdout data", () => {
    const proc = new FakeProcess();
    spawnCommandMock.mockReturnValue(proc);
    const stream = new LogcatStream();
    const messages: string[] = [];

    stream.on("entry", (entry) => {
      messages.push(entry.message);
    });

    stream.start();
    proc.stdout.emit("data", "01-10 12:34:56.789  1234  5678 I MyTag   : Partial");
    proc.stdout.emit("data", " message\n");

    expect(messages).toEqual(["Partial message"]);
  });

  it("stops an active stream by killing the process", () => {
    const proc = new FakeProcess();
    spawnCommandMock.mockReturnValue(proc);
    const stream = new LogcatStream();

    stream.start();
    stream.stop();

    expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
    expect(stream.isRunning).toBe(false);
  });

  it("clears logcat buffers through adb", async () => {
    const proc = new FakeProcess();
    spawnCommandMock.mockReturnValue(proc);

    const promise = clearLogcat("adb-custom", "serial-1");
    proc.emit("close", 0);

    await expect(promise).resolves.toBeUndefined();
    expect(spawnCommandMock).toHaveBeenCalledWith({
      command: "adb-custom",
      args: ["-s", "serial-1", "logcat", "-c"],
    });
  });

  it("reads buffered logcat output", async () => {
    const proc = new FakeProcess();
    spawnCommandMock.mockReturnValue(proc);

    const promise = getLogcat("adb-custom", "serial-2", 25);
    proc.stdout.emit("data", "line one\n");
    proc.stdout.emit("data", "line two\n");
    proc.emit("close", 0);

    await expect(promise).resolves.toBe("line one\nline two\n");
    expect(spawnCommandMock).toHaveBeenCalledWith({
      command: "adb-custom",
      args: ["-s", "serial-2", "logcat", "-d", "-t", "25"],
    });
  });
});
