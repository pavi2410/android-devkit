import { EventEmitter } from "node:events";
import { Logcat, AndroidLogPriority, type AndroidLogEntry } from "@yume-chan/android-bin";
import type { ReadableStream } from "@yume-chan/stream-extra";
import type { LogcatEntry, LogLevel, LogcatOptions } from "./types.js";

export type { LogcatEntry, LogLevel, LogcatOptions } from "./types.js";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  V: 0,
  D: 1,
  I: 2,
  W: 3,
  E: 4,
  F: 5,
  S: 6,
};

const PRIORITY_TO_LEVEL: Record<number, LogLevel> = {
  [AndroidLogPriority.Verbose]: "V",
  [AndroidLogPriority.Debug]: "D",
  [AndroidLogPriority.Info]: "I",
  [AndroidLogPriority.Warn]: "W",
  [AndroidLogPriority.Error]: "E",
  [AndroidLogPriority.Fatal]: "F",
  [AndroidLogPriority.Silent]: "S",
};

const NANOSECONDS_PER_MILLISECOND = BigInt(1e6);

function stripNul(s: string): string {
  return s.replaceAll("\0", "");
}

function toLogcatEntry(entry: AndroidLogEntry): LogcatEntry {
  const timestampMs = Number(entry.timestamp / NANOSECONDS_PER_MILLISECOND);
  return {
    timestamp: new Date(timestampMs),
    pid: entry.pid,
    tid: entry.tid,
    level: PRIORITY_TO_LEVEL[entry.priority] ?? "V",
    tag: stripNul(entry.tag),
    message: stripNul(entry.message),
  };
}

export class LogcatStream extends EventEmitter {
  private stream: ReadableStream<AndroidLogEntry> | null = null;
  private running = false;
  private readonly logcat: Logcat;
  private readonly minLevel: LogLevel;
  private readonly pid?: number;

  constructor(logcat: Logcat, options: LogcatOptions = {}) {
    super();
    this.logcat = logcat;
    this.minLevel = options.minLevel ?? "V";
    this.pid = options.pid;
  }

  start(): void {
    if (this.running) throw new Error("Logcat stream already running");
    this.running = true;

    this.stream = this.logcat.binary({
      pid: this.pid,
    });

    this.emit("start");
    this.readLoop();
  }

  private async readLoop(): Promise<void> {
    const stream = this.stream;
    if (!stream) return;

    const reader = stream.getReader();
    try {
      while (this.running) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const entry = toLogcatEntry(value);
          if (this.shouldEmit(entry)) {
            this.emit("entry", entry);
          }
        }
      }
    } catch (err) {
      if (this.running) {
        this.emit("error", err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      reader.releaseLock();
      this.running = false;
      this.stream = null;
      this.emit("close", 0);
    }
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.stream?.cancel().catch(() => {});
    this.stream = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  private shouldEmit(entry: LogcatEntry): boolean {
    return LOG_LEVEL_PRIORITY[entry.level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }
}

export async function clearLogcat(logcat: Logcat): Promise<void> {
  await logcat.clear();
}

export async function getLogcat(logcat: Logcat, lines: number = 1000): Promise<LogcatEntry[]> {
  const stream = logcat.binary({ dump: true, tail: lines });
  const reader = stream.getReader();
  const entries: LogcatEntry[] = [];

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      entries.push(toLogcatEntry(value));
    }
  } finally {
    reader.releaseLock();
  }

  return entries;
}
