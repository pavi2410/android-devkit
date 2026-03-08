import { describe, expect, it, vi, beforeEach } from "vitest";

const { FakeStream, clearLogcatMock } = vi.hoisted(() => {
  const clearLogcatMock = vi.fn();
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

  return { FakeStream, clearLogcatMock };
});

vi.mock("@android-devkit/logcat", () => ({
  LogcatStream: FakeStream,
  clearLogcat: clearLogcatMock,
}));

import { LogcatService } from "../../src/services/logcat";

function createMockAdbService() {
  return {
    getAdbPathPublic: vi.fn().mockReturnValue("/usr/bin/adb"),
  } as any;
}

describe("LogcatService", () => {
  let service: LogcatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LogcatService(createMockAdbService());
  });

  it("start delegates to LogcatStream", () => {
    service.start({ serial: "emulator-5554", minLevel: "W" });

    expect(service.isRunning).toBe(true);
    const stream = FakeStream.getCurrent();
    expect(stream).toBeDefined();
    expect(stream.isRunning).toBe(true);
  });

  it("stop stops the active stream", () => {
    service.start();
    service.stop();

    expect(service.isRunning).toBe(false);
  });

  it("propagates logcat entries", () => {
    const entries: unknown[] = [];
    service.onLogcatEntry((e) => entries.push(e));

    service.start();
    FakeStream.getCurrent().emit("entry", { tag: "Test", message: "hello" });

    expect(entries).toHaveLength(1);
  });

  it("propagates errors", () => {
    const errors: Error[] = [];
    service.onError((e) => errors.push(e));

    service.start();
    FakeStream.getCurrent().emit("error", new Error("stream failed"));

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("stream failed");
  });

  it("fires state changes", () => {
    const states: boolean[] = [];
    service.onStateChanged((s) => states.push(s));

    service.start();
    FakeStream.getCurrent().emit("close");

    expect(states).toContain(false);
  });

  it("clear delegates to clearLogcat", async () => {
    clearLogcatMock.mockResolvedValue(undefined);

    await service.clear("emulator-5554");

    expect(clearLogcatMock).toHaveBeenCalledWith("/usr/bin/adb", "emulator-5554");
  });

  it("dispose stops stream and disposes emitters", () => {
    service.start();
    service.dispose();

    expect(service.isRunning).toBe(false);
  });
});
