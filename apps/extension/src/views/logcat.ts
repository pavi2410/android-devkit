import * as vscode from "vscode";
import type { LogcatEntry, LogLevel } from "@android-devkit/logcat";
import type { LogcatService } from "../services/logcat";
import { CONTEXT_KEYS } from "../commands/ids";
import { setAndroidDevkitContext } from "../config/context";
import { getLogcatDefaultLogLevel, getLogcatMaxLines } from "../config/settings";

type LogcatSessionState = "stopped" | "running" | "paused";

interface LogcatSessionOptions {
  deviceLabel?: string;
  minLevel: LogLevel;
  packageName?: string;
  pid?: number;
  serial?: string;
}

function getDefaultLogLevel(): LogLevel {
  return getLogcatDefaultLogLevel();
}

export class LogcatTreeProvider implements vscode.TreeDataProvider<LogcatTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<LogcatTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private _onDidSessionChange = new vscode.EventEmitter<void>();
  readonly onDidSessionChange = this._onDidSessionChange.event;

  private outputChannel: vscode.LogOutputChannel;
  private entries: LogcatEntry[] = [];
  private maxEntries: number;
  private filter?: string;
  private hasAvailableDevices = false;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private session: LogcatSessionOptions;
  private sessionState: LogcatSessionState = "stopped";

  constructor(private logcatService: LogcatService, private context?: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel("ADK: Logcat", { log: true });
    this.maxEntries = getLogcatMaxLines();

    // Restore persisted filter state
    const persistedLevel = context?.workspaceState.get<LogLevel>("logcat.minLevel");
    const persistedFilter = context?.workspaceState.get<string>("logcat.filter");
    const persistedPackage = context?.workspaceState.get<string>("logcat.packageName");
    this.session = { minLevel: persistedLevel ?? getDefaultLogLevel(), packageName: persistedPackage };
    this.filter = persistedFilter;

    // Listen for logcat entries
    logcatService.onLogcatEntry((entry) => {
      this.addEntry(entry);
    });

    logcatService.onError((error) => {
      vscode.window.showErrorMessage(`Logcat error: ${error.message}`);
    });

    logcatService.onStateChanged((running) => {
      if (running) {
        this.sessionState = "running";
      } else if (this.sessionState !== "paused") {
        this.sessionState = "stopped";
      }
      this.emitSessionChange();
      this.refresh();
    });

    this.emitSessionChange();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      this.refresh();
    }, 500);
  }

  getTreeItem(element: LogcatTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: LogcatTreeItem): Promise<LogcatTreeItem[]> {
    if (element) return [];

    if (!this.hasAvailableDevices) {
      return [];
    }

    if (this.sessionState === "stopped" && this.entries.length === 0 && !this.filter && !this.session.packageName) {
      return [];
    }

    const items: LogcatTreeItem[] = [];

    // Status item
    if (this.sessionState === "running") {
      items.push(new StatusItem("Running", this.session.deviceLabel ?? this.session.serial ?? "All devices", "play"));
    } else if (this.sessionState === "paused") {
      items.push(new StatusItem("Paused", this.session.deviceLabel ?? this.session.serial ?? "All devices", "debug-pause"));
    } else {
      items.push(new StatusItem("Stopped", "Click play to start", "debug-stop"));
    }

    items.push(new LevelItem(this.session.minLevel));

    // Filter item
    if (this.filter) {
      items.push(new FilterItem(this.filter));
    }

    // Package filter item
    if (this.session.packageName) {
      const desc = this.session.pid
        ? `${this.session.packageName} (PID: ${this.session.pid})`
        : `${this.session.packageName} (PID unavailable)`;
      items.push(new PackageFilterItem(desc));
    }

    // Stats
    items.push(new StatsItem(this.entries.length, this.maxEntries));

    return items;
  }

  /**
   * Add a log entry and write to output channel
   */
  private addEntry(entry: LogcatEntry): void {
    // Check level filter
    const levels: LogLevel[] = ["V", "D", "I", "W", "E", "F", "S"];
    if (levels.indexOf(entry.level) < levels.indexOf(this.session.minLevel)) {
      return;
    }

    // Check text filter
    if (this.filter) {
      const filterLower = this.filter.toLowerCase();
      if (
        !entry.tag.toLowerCase().includes(filterLower) &&
        !entry.message.toLowerCase().includes(filterLower)
      ) {
        return;
      }
    }

    // Check package/PID filter
    if (this.session.pid && entry.pid !== this.session.pid) {
      return;
    }

    // Add to entries list (with max limit)
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Write to output channel
    this.writeToOutput(entry);
    this.scheduleRefresh();
  }

  /**
   * Write entry to output channel with formatting
   */
  private writeToOutput(entry: LogcatEntry): void {
    const time = entry.timestamp.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });

    const message = this.linkifyStackTrace(entry.message);
    const line = `${time} ${entry.pid.toString().padStart(5)} ${entry.tid.toString().padStart(5)} ${entry.level} ${entry.tag}: ${message}`;

    // Use appropriate log level method
    switch (entry.level) {
      case "V":
        this.outputChannel.trace(line);
        break;
      case "D":
        this.outputChannel.debug(line);
        break;
      case "I":
        this.outputChannel.info(line);
        break;
      case "W":
        this.outputChannel.warn(line);
        break;
      case "E":
      case "F":
        this.outputChannel.error(line);
        break;
      default:
        this.outputChannel.appendLine(line);
    }
  }

  /**
   * Attempt to resolve stack trace file references to workspace paths
   * so VS Code can auto-linkify them in the output channel.
   */
  private linkifyStackTrace(message: string): string {
    // Match Java/Kotlin stack trace: "at com.example.Class.method(FileName.java:42)"
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

  private resolvedFileCache = new Map<string, string | null>();

  private async resolveSourceFile(filename: string): Promise<void> {
    try {
      const files = await vscode.workspace.findFiles(`**/${filename}`, "**/build/**", 1);
      this.resolvedFileCache.set(filename, files[0]?.fsPath ?? null);
    } catch {
      this.resolvedFileCache.set(filename, null);
    }
  }

  getSession(): Readonly<LogcatSessionOptions> {
    return this.session;
  }

  getSessionState(): LogcatSessionState {
    return this.sessionState;
  }

  setHasAvailableDevices(hasAvailableDevices: boolean): void {
    this.hasAvailableDevices = hasAvailableDevices;
    if (!hasAvailableDevices && this.sessionState !== "stopped") {
      this.stop();
      vscode.window.showWarningMessage("Logcat stopped: device disconnected.");
      return;
    }

    this.emitSessionChange();
    this.refresh();
  }

  private emitSessionChange(): void {
    void setAndroidDevkitContext(CONTEXT_KEYS.logcatPaused, this.sessionState === "paused");
    void setAndroidDevkitContext(CONTEXT_KEYS.logcatRunning, this.sessionState === "running");
    this._onDidSessionChange.fire();
  }

  /**
   * Start logcat streaming
   */
  start(options: Partial<LogcatSessionOptions> = {}): void {
    this.session = {
      ...this.session,
      ...options,
      minLevel: options.minLevel ?? this.session.minLevel,
    };
    this.sessionState = "running";
    this.outputChannel.show(true);
    this.logcatService.start({
      minLevel: this.session.minLevel,
      pid: this.session.pid,
      serial: this.session.serial,
    });
    this.emitSessionChange();
    this.refresh();
  }

  pause(): void {
    if (this.sessionState !== "running") {
      return;
    }

    this.sessionState = "paused";
    this.logcatService.stop();
    this.emitSessionChange();
    this.refresh();
  }

  resume(): void {
    this.start();
  }

  /**
   * Stop logcat streaming
   */
  stop(): void {
    this.sessionState = "stopped";
    this.logcatService.stop();
    this.emitSessionChange();
    this.refresh();
  }

  /**
   * Clear logs
   */
  async clear(device?: string): Promise<void> {
    this.entries = [];
    this.outputChannel.clear();
    await this.logcatService.clear(device ?? this.session.serial);
    this.refresh();
  }

  /**
   * Set text filter
   */
  setFilter(filter?: string): void {
    this.filter = filter;
    void this.context?.workspaceState.update("logcat.filter", filter);
    this.emitSessionChange();
    this.refresh();
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.session = { ...this.session, minLevel: level };
    void this.context?.workspaceState.update("logcat.minLevel", level);
    if (this.sessionState === "running") {
      this.start({ minLevel: level });
      return;
    }

    this.emitSessionChange();
    this.refresh();
  }

  /**
   * Set package name filter (optionally with resolved PID)
   */
  setPackageFilter(packageName?: string, pid?: number): void {
    this.session = { ...this.session, packageName, pid };
    void this.context?.workspaceState.update("logcat.packageName", packageName);
    if (this.sessionState === "running") {
      this.start({ packageName, pid });
      return;
    }

    this.emitSessionChange();
    this.refresh();
  }

  /**
   * Show the output channel
   */
  show(): void {
    this.outputChannel.show();
  }

  getEntries(): readonly LogcatEntry[] {
    return this.entries;
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

  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.outputChannel.dispose();
    this._onDidSessionChange.dispose();
    this._onDidChangeTreeData.dispose();
  }
}

class LogcatTreeItem extends vscode.TreeItem {}

class StatusItem extends LogcatTreeItem {
  constructor(status: string, detail: string, icon: string) {
    super(status, vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

class FilterItem extends LogcatTreeItem {
  constructor(filter: string) {
    super("Filter", vscode.TreeItemCollapsibleState.None);
    this.description = filter;
    this.iconPath = new vscode.ThemeIcon("filter");
  }
}

class LevelItem extends LogcatTreeItem {
  constructor(level: LogLevel) {
    super("Level", vscode.TreeItemCollapsibleState.None);
    this.description = level;
    this.iconPath = new vscode.ThemeIcon("symbol-enum");
  }
}

class PackageFilterItem extends LogcatTreeItem {
  constructor(detail: string) {
    super("Package", vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    this.iconPath = new vscode.ThemeIcon("package");
  }
}

class StatsItem extends LogcatTreeItem {
  constructor(count: number, max: number) {
    super("Entries", vscode.TreeItemCollapsibleState.None);
    this.description = `${count.toLocaleString()} / ${max.toLocaleString()}`;
    this.iconPath = new vscode.ThemeIcon("list-ordered");
  }
}
