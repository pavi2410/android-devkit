import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { LogcatEntry, LogLevel } from "./types.js";

/**
 * Options for logcat streaming
 */
export interface LogcatOptions {
  /** Path to ADB binary */
  adbPath?: string;
  /** Device serial */
  serial?: string;
  /** Filter by log level (minimum level to show) */
  minLevel?: LogLevel;
  /** Filter by tag pattern */
  tags?: string[];
  /** Filter by package name (requires API 31+) */
  pid?: number;
  /** Clear logs before streaming */
  clear?: boolean;
}

/**
 * Log level priority (higher = more severe)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  V: 0, // Verbose
  D: 1, // Debug
  I: 2, // Info
  W: 3, // Warning
  E: 4, // Error
  F: 5, // Fatal
  S: 6, // Silent
};

/**
 * Parse a logcat line in threadtime format
 * Format: MM-DD HH:MM:SS.mmm PID TID LEVEL TAG: MESSAGE
 */
function parseLogcatLine(line: string): LogcatEntry | null {
  // Example: 01-10 12:34:56.789  1234  5678 D MyTag   : Hello world
  const regex = /^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+([^:]+?)\s*:\s*(.*)$/;
  const match = line.match(regex);

  if (!match) return null;

  const [, date, time, pid, tid, level, tag, message] = match;
  const currentYear = new Date().getFullYear();
  const timestamp = new Date(`${currentYear}-${date}T${time}`);

  return {
    timestamp,
    pid: parseInt(pid, 10),
    tid: parseInt(tid, 10),
    level: level as LogLevel,
    tag: tag.trim(),
    message,
  };
}

/**
 * Logcat stream that emits parsed log entries
 */
export class LogcatStream extends EventEmitter {
  private process: ChildProcess | null = null;
  private adbPath: string;
  private serial?: string;
  private minLevel: LogLevel;
  private tags: string[];
  private buffer: string = "";

  constructor(options: LogcatOptions = {}) {
    super();
    this.adbPath = options.adbPath ?? "adb";
    this.serial = options.serial;
    this.minLevel = options.minLevel ?? "V";
    this.tags = options.tags ?? [];
  }

  /**
   * Start streaming logcat
   */
  start(): void {
    if (this.process) {
      throw new Error("Logcat stream already running");
    }

    const args: string[] = [];
    if (this.serial) {
      args.push("-s", this.serial);
    }
    args.push("logcat", "-v", "threadtime");

    // Add tag filters
    if (this.tags.length > 0) {
      // Format: TAG:LEVEL
      for (const tag of this.tags) {
        args.push(`${tag}:${this.minLevel}`);
      }
      args.push("*:S"); // Silence everything else
    }

    this.process = spawn(this.adbPath, args);

    this.process.stdout?.on("data", (data: Buffer) => {
      this.handleData(data.toString());
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      this.emit("error", new Error(data.toString()));
    });

    this.process.on("close", (code) => {
      this.process = null;
      this.emit("close", code);
    });

    this.process.on("error", (err) => {
      this.emit("error", err);
    });

    this.emit("start");
  }

  /**
   * Stop streaming logcat
   */
  stop(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }

  /**
   * Check if streaming
   */
  get isRunning(): boolean {
    return this.process !== null;
  }

  /**
   * Handle incoming data
   */
  private handleData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split("\n");

    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      const entry = parseLogcatLine(line);
      if (entry && this.shouldEmit(entry)) {
        this.emit("entry", entry);
      }
    }
  }

  /**
   * Check if entry passes filters
   */
  private shouldEmit(entry: LogcatEntry): boolean {
    // Check log level
    if (LOG_LEVEL_PRIORITY[entry.level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return false;
    }

    return true;
  }
}

/**
 * Clear logcat buffer on device
 */
export async function clearLogcat(
  adbPath: string = "adb",
  serial?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = serial
      ? ["-s", serial, "logcat", "-c"]
      : ["logcat", "-c"];

    const proc = spawn(adbPath, args);

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to clear logcat (exit code ${code})`));
      }
    });

    proc.on("error", reject);
  });
}

/**
 * Get logcat as a string (non-streaming)
 */
export async function getLogcat(
  adbPath: string = "adb",
  serial?: string,
  lines: number = 1000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = serial
      ? ["-s", serial, "logcat", "-d", "-t", lines.toString()]
      : ["logcat", "-d", "-t", lines.toString()];

    const proc = spawn(adbPath, args);
    let output = "";

    proc.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
    });

    proc.on("close", () => {
      resolve(output);
    });

    proc.on("error", reject);
  });
}
