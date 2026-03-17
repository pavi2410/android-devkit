import * as vscode from "vscode";
import type { LogcatEntry, LogLevel } from "@android-devkit/logcat";
import type { LogcatService } from "../services/logcat";
import { CONTEXT_KEYS } from "../commands/ids";
import { setAndroidDevkitContext } from "../config/context";
import { getLogcatDefaultLogLevel, getLogcatMaxLines } from "../config/settings";
import { LogcatBuffer } from "../models/logcat-buffer";
import { getOutputChannel } from "../utils/output";

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
  private buffer: LogcatBuffer;
  private filter?: string;
  private hasAvailableDevices = false;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private session: LogcatSessionOptions;
  private sessionState: LogcatSessionState = "stopped";

  constructor(private logcatService: LogcatService, private context?: vscode.ExtensionContext) {
    this.outputChannel = getOutputChannel("Logcat", { log: true });
    this.buffer = new LogcatBuffer(getLogcatMaxLines());

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

    if (this.sessionState === "stopped" && this.buffer.length === 0 && !this.filter && !this.session.packageName) {
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
    items.push(new StatsItem(this.buffer.length, getLogcatMaxLines()));

    return items;
  }

  /**
   * Add a log entry and write to output channel
   */
  private addEntry(entry: LogcatEntry): void {
    const added = this.buffer.add(entry, this.session.minLevel, this.filter, this.session.pid);
    if (!added) return;

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

    const message = this.buffer.linkifyStackTrace(entry.message);
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
    }).catch((err) => {
      vscode.window.showErrorMessage(`Failed to start logcat: ${err instanceof Error ? err.message : String(err)}`);
      this.sessionState = "stopped";
      this.emitSessionChange();
      this.refresh();
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
    this.buffer.clear();
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
    return this.buffer.getEntries();
  }

  static formatEntry(entry: LogcatEntry): string {
    return LogcatBuffer.formatEntry(entry);
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
