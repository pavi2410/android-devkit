import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { spawnCommand } from "@android-devkit/tool-core";
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

function parseLogcatLine(line: string): LogcatEntry | null {
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

export class LogcatStream extends EventEmitter {
  private proc: ChildProcess | null = null;
  private readonly adbPath: string;
  private readonly serial?: string;
  private readonly minLevel: LogLevel;
  private readonly tags: string[];
  private buffer = "";

  constructor(options: LogcatOptions = {}) {
    super();
    this.adbPath = options.adbPath ?? "adb";
    this.serial = options.serial;
    this.minLevel = options.minLevel ?? "V";
    this.tags = options.tags ?? [];
  }

  start(): void {
    if (this.proc) throw new Error("Logcat stream already running");

    const args: string[] = [];
    if (this.serial) args.push("-s", this.serial);
    args.push("logcat", "-v", "threadtime");

    if (this.tags.length > 0) {
      for (const tag of this.tags) {
        args.push(`${tag}:${this.minLevel}`);
      }
      args.push("*:S");
    }

    const proc = spawnCommand({ command: this.adbPath, args });
    this.proc = proc;

    proc.stdout?.on("data", (data: Buffer | string) => {
      this.handleData(data.toString());
    });

    proc.stderr?.on("data", (data: Buffer | string) => {
      this.emit("error", new Error(data.toString()));
    });

    proc.on("close", (code: number | null) => {
      this.proc = null;
      this.emit("close", code);
    });

    proc.on("error", (error: Error) => {
      this.emit("error", error);
    });

    this.emit("start");
  }

  stop(): void {
    if (!this.proc) return;
    this.proc.kill("SIGTERM");
    this.proc = null;
  }

  get isRunning(): boolean {
    return this.proc !== null;
  }

  private handleData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const entry = parseLogcatLine(line);
      if (entry && this.shouldEmit(entry)) {
        this.emit("entry", entry);
      }
    }
  }

  private shouldEmit(entry: LogcatEntry): boolean {
    return LOG_LEVEL_PRIORITY[entry.level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }
}

export async function clearLogcat(adbPath: string = "adb", serial?: string): Promise<void> {
  const proc = spawnCommand({
    command: adbPath,
    args: serial ? ["-s", serial, "logcat", "-c"] : ["logcat", "-c"],
  });

  await new Promise<void>((resolve, reject) => {
    proc.on("close", (code: number | null) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to clear logcat (exit code ${code})`));
    });
    proc.on("error", reject);
  });
}

export async function getLogcat(adbPath: string = "adb", serial?: string, lines: number = 1000): Promise<string> {
  const proc = spawnCommand({
    command: adbPath,
    args: serial ? ["-s", serial, "logcat", "-d", "-t", lines.toString()] : ["logcat", "-d", "-t", lines.toString()],
  });

  return await new Promise<string>((resolve, reject) => {
    let output = "";
    proc.stdout?.on("data", (data: Buffer | string) => {
      output += data.toString();
    });
    proc.on("close", () => resolve(output));
    proc.on("error", reject);
  });
}
