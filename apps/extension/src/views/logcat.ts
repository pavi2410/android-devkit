import * as vscode from "vscode";
import type { LogcatEntry, LogLevel } from "@android-devkit/logcat";
import type { LogcatService } from "../services/logcat";
import { CONTEXT_KEYS, VS_CODE_COMMANDS } from "../commands/ids";

type LogcatSessionState = "stopped" | "running" | "paused";

interface LogcatSessionOptions {
  deviceLabel?: string;
  minLevel: LogLevel;
  packageName?: string;
  pid?: number;
  serial?: string;
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
  private session: LogcatSessionOptions = { minLevel: "I" };
  private sessionState: LogcatSessionState = "stopped";

  constructor(private logcatService: LogcatService) {
    this.outputChannel = vscode.window.createOutputChannel("ADK: Logcat", { log: true });
    this.maxEntries = vscode.workspace.getConfiguration("androidDevkit").get("logcat.maxLines", 10000);

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
    this.refresh();
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

    const line = `${time} ${entry.pid.toString().padStart(5)} ${entry.tid.toString().padStart(5)} ${entry.level} ${entry.tag}: ${entry.message}`;

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
      return;
    }

    this.emitSessionChange();
    this.refresh();
  }

  private emitSessionChange(): void {
    void vscode.commands.executeCommand(
      VS_CODE_COMMANDS.setContext,
      CONTEXT_KEYS.logcatPaused,
      this.sessionState === "paused"
    );
    void vscode.commands.executeCommand(
      VS_CODE_COMMANDS.setContext,
      CONTEXT_KEYS.logcatRunning,
      this.sessionState === "running"
    );
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
    this.emitSessionChange();
    this.refresh();
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.session = { ...this.session, minLevel: level };
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

  dispose(): void {
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
