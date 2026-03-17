import * as vscode from "vscode";
import { AdbService } from "./adb";
import { SdkService } from "./sdk";
import { GradleService } from "./gradle";
import { LogcatService } from "./logcat";
import { ScrcpyService } from "./scrcpy";

export class ServiceContainer implements vscode.Disposable {
  readonly sdk: SdkService;
  readonly adb: AdbService;
  readonly logcat: LogcatService;
  readonly scrcpy: ScrcpyService;
  readonly gradle: GradleService;

  constructor(extensionUri: vscode.Uri) {
    this.sdk = new SdkService();
    this.adb = new AdbService(this.sdk);
    this.logcat = new LogcatService(this.adb);
    this.scrcpy = new ScrcpyService(this.adb, extensionUri);
    this.gradle = new GradleService();
  }

  dispose(): void {
    this.scrcpy.dispose();
    this.logcat.dispose();
    this.adb.dispose();
    this.sdk.dispose();
  }
}
