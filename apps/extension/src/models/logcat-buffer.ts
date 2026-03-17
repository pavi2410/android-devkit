import * as vscode from "vscode";
import type { LogcatEntry, LogLevel } from "@android-devkit/logcat";

const LOG_LEVELS: LogLevel[] = ["V", "D", "I", "W", "E", "F", "S"];

export class LogcatBuffer {
  private entries: LogcatEntry[] = [];
  private resolvedFileCache = new Map<string, string | null>();

  constructor(private maxEntries: number) {}

  /**
   * Add an entry if it passes the given filters. Returns true if added.
   */
  add(entry: LogcatEntry, minLevel: LogLevel, filter?: string, pid?: number): boolean {
    if (!this.matchesFilters(entry, minLevel, filter, pid)) {
      return false;
    }

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    return true;
  }

  clear(): void {
    this.entries = [];
  }

  getEntries(): readonly LogcatEntry[] {
    return this.entries;
  }

  get length(): number {
    return this.entries.length;
  }

  private matchesFilters(entry: LogcatEntry, minLevel: LogLevel, filter?: string, pid?: number): boolean {
    // Check level filter
    if (LOG_LEVELS.indexOf(entry.level) < LOG_LEVELS.indexOf(minLevel)) {
      return false;
    }

    // Check text filter
    if (filter) {
      const filterLower = filter.toLowerCase();
      if (
        !entry.tag.toLowerCase().includes(filterLower) &&
        !entry.message.toLowerCase().includes(filterLower)
      ) {
        return false;
      }
    }

    // Check PID filter
    if (pid && entry.pid !== pid) {
      return false;
    }

    return true;
  }

  /**
   * Attempt to resolve stack trace file references to workspace paths
   * so VS Code can auto-linkify them in the output channel.
   */
  linkifyStackTrace(message: string): string {
    const stackTraceRegex = /^(\s*at\s+\S+)\((\w+\.\w+):(\d+)\)$/;
    const match = message.match(stackTraceRegex);
    if (!match) return message;

    const [, prefix, filename, lineNum] = match;
    const resolved = this.resolvedFileCache.get(filename);
    if (resolved !== undefined) {
      return resolved
        ? `${prefix}(${resolved}:${lineNum})`
        : message;
    }

    // Async resolve, won't linkify this occurrence but will cache for next
    void this.resolveSourceFile(filename);
    return message;
  }

  private async resolveSourceFile(filename: string): Promise<void> {
    try {
      const files = await vscode.workspace.findFiles(`**/${filename}`, "**/build/**", 1);
      this.resolvedFileCache.set(filename, files[0]?.fsPath ?? null);
    } catch {
      this.resolvedFileCache.set(filename, null);
    }
  }

  static formatEntry(entry: LogcatEntry): string {
    const time = entry.timestamp.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
    return `${time} ${entry.pid.toString().padStart(5)} ${entry.tid.toString().padStart(5)} ${entry.level} ${entry.tag}: ${entry.message}`;
  }
}
