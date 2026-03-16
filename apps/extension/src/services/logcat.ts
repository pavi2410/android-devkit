import * as vscode from "vscode";
import {
  LogcatStream,
  clearLogcat,
  type LogcatEntry,
  type LogcatOptions,
} from "@android-devkit/logcat";
import type { AdbService } from "./adb";

export class LogcatService implements vscode.Disposable {
  private stream: LogcatStream | null = null;
  private readonly onEntryEmitter = new vscode.EventEmitter<LogcatEntry>();
  private readonly onErrorEmitter = new vscode.EventEmitter<Error>();
  private readonly onStateChangedEmitter = new vscode.EventEmitter<boolean>();

  readonly onLogcatEntry = this.onEntryEmitter.event;
  readonly onError = this.onErrorEmitter.event;
  readonly onStateChanged = this.onStateChangedEmitter.event;

  constructor(private readonly adbService: AdbService) {}

  get isRunning(): boolean {
    return this.stream?.isRunning ?? false;
  }

  async start(options: LogcatOptions & { serial?: string } = {}): Promise<void> {
    this.stop();

    if (!options.serial) {
      throw new Error("Serial is required to start logcat");
    }

    const logcat = await this.adbService.createLogcat(options.serial);

    const stream = new LogcatStream(logcat, {
      minLevel: options.minLevel,
      pid: options.pid,
    });

    stream.on("entry", (entry: LogcatEntry) => {
      this.onEntryEmitter.fire(entry);
    });

    stream.on("error", (error: Error) => {
      this.onErrorEmitter.fire(error);
    });

    stream.on("close", () => {
      this.stream = null;
      this.onStateChangedEmitter.fire(false);
    });

    this.stream = stream;
    stream.start();
    this.onStateChangedEmitter.fire(true);
  }

  stop(): void {
    if (!this.stream) return;

    const activeStream = this.stream;
    this.stream = null;
    activeStream.stop();
    this.onStateChangedEmitter.fire(false);
  }

  async clear(serial?: string): Promise<void> {
    if (!serial) return;
    const logcatInstance = await this.adbService.createLogcat(serial);
    await clearLogcat(logcatInstance);
  }

  dispose(): void {
    this.stop();
    this.onEntryEmitter.dispose();
    this.onErrorEmitter.dispose();
    this.onStateChangedEmitter.dispose();
  }
}
