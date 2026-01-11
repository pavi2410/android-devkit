import * as vscode from "vscode";
import type { AdbService } from "../services/adb";
import type { LogcatEntry, LogLevel } from "@android-devkit/adb";

/**
 * Log level colors for output channel
 */
const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  V: "gray",
  D: "blue",
  I: "green",
  W: "yellow",
  E: "red",
  F: "magenta",
  S: "white",
};

export class LogcatTreeProvider implements vscode.TreeDataProvider<LogcatTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<LogcatTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private outputChannel: vscode.LogOutputChannel;
  private entries: LogcatEntry[] = [];
  private maxEntries: number;
  private currentDevice?: string;
  private filter?: string;
  private minLevel: LogLevel = "V";

  constructor(private adbService: AdbService) {
    this.outputChannel = vscode.window.createOutputChannel("Android Logcat", { log: true });
    this.maxEntries = vscode.workspace.getConfiguration("androidDevkit").get("logcat.maxLines", 10000);

    // Listen for logcat entries
    adbService.onLogcatEntry((entry) => {
      this.addEntry(entry);
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: LogcatTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: LogcatTreeItem): Promise<LogcatTreeItem[]> {
    if (element) return [];

    const items: LogcatTreeItem[] = [];

    // Status item
    if (this.adbService.isLogcatRunning) {
      items.push(new StatusItem("Running", this.currentDevice ?? "All devices", "play"));
    } else {
      items.push(new StatusItem("Stopped", "Click play to start", "debug-stop"));
    }

    // Filter item
    if (this.filter) {
      items.push(new FilterItem(this.filter));
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
    if (levels.indexOf(entry.level) < levels.indexOf(this.minLevel)) {
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

  /**
   * Start logcat streaming
   */
  start(device?: string, tags?: string[]): void {
    this.currentDevice = device;
    this.outputChannel.show(true);
    this.adbService.startLogcat(device, tags);
    vscode.commands.executeCommand("setContext", "androidDevkit.logcatRunning", true);
    this.refresh();
  }

  /**
   * Stop logcat streaming
   */
  stop(): void {
    this.adbService.stopLogcat();
    vscode.commands.executeCommand("setContext", "androidDevkit.logcatRunning", false);
    this.refresh();
  }

  /**
   * Clear logs
   */
  async clear(device?: string): Promise<void> {
    this.entries = [];
    this.outputChannel.clear();
    await this.adbService.clearLogcat(device ?? this.currentDevice);
    this.refresh();
  }

  /**
   * Set text filter
   */
  setFilter(filter?: string): void {
    this.filter = filter;
    this.refresh();
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
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

class StatsItem extends LogcatTreeItem {
  constructor(count: number, max: number) {
    super("Entries", vscode.TreeItemCollapsibleState.None);
    this.description = `${count.toLocaleString()} / ${max.toLocaleString()}`;
    this.iconPath = new vscode.ThemeIcon("list-ordered");
  }
}
