import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  getSdkManagerPath,
  listSdkPackages,
  installSdkPackage,
  uninstallSdkPackage,
  updateAllSdkPackages,
  type SdkPackage,
} from "@android-devkit/sdk";
import {
  getAvdManagerPath,
  getEmulatorPath,
  listAvds,
  listDeviceProfiles,
  createAvd,
  deleteAvd,
  launchAvd,
  wipeAvdData,
  type Avd,
  type DeviceProfile,
  type CreateAvdOptions,
} from "@android-devkit/avd";

export type { SdkPackage, Avd, DeviceProfile, CreateAvdOptions };

export class SdkService {
  private _onSdkPackagesChanged = new vscode.EventEmitter<void>();
  private _onAvdsChanged = new vscode.EventEmitter<void>();

  readonly onSdkPackagesChanged = this._onSdkPackagesChanged.event;
  readonly onAvdsChanged = this._onAvdsChanged.event;

  getSdkPath(): string | undefined {
    const config = vscode.workspace.getConfiguration("androidDevkit");
    const configuredPath = config.get<string>("sdkPath");
    if (configuredPath && fs.existsSync(configuredPath)) return configuredPath;

    for (const envPath of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]) {
      if (envPath && fs.existsSync(envPath)) return envPath;
    }

    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    const localAppData = process.env.LOCALAPPDATA ?? "";
    const candidates = [
      path.join(home, "Library", "Android", "sdk"),
      path.join(home, "Android", "Sdk"),
      path.join(localAppData, "Android", "Sdk"),
      "/opt/homebrew/share/android-commandlinetools",
      "/usr/local/android-sdk",
      "/opt/android-sdk",
    ];
    for (const p of candidates) {
      if (p && fs.existsSync(p)) return p;
    }
    return undefined;
  }

  getSdkManagerPath(): string | undefined {
    const sdkPath = this.getSdkPath();
    return sdkPath ? getSdkManagerPath(sdkPath) : undefined;
  }

  getAvdManagerPath(): string | undefined {
    const sdkPath = this.getSdkPath();
    return sdkPath ? getAvdManagerPath(sdkPath) : undefined;
  }

  getEmulatorPath(): string | undefined {
    const sdkPath = this.getSdkPath();
    return sdkPath ? getEmulatorPath(sdkPath) : undefined;
  }

  async listSdkPackages(): Promise<SdkPackage[]> {
    const sdkPath = this.getSdkPath();
    if (!sdkPath) throw new Error("Android SDK not found. Configure androidDevkit.sdkPath.");
    return listSdkPackages(sdkPath);
  }

  installPackage(id: string, outputChannel: vscode.OutputChannel): Promise<void> {
    const sdkPath = this.getSdkPath();
    if (!sdkPath) return Promise.reject(new Error("Android SDK not found."));
    return new Promise((resolve, reject) => {
      outputChannel.show(true);
      outputChannel.appendLine(`Installing ${id}…`);
      const proc = installSdkPackage(sdkPath, id);
      proc.stdout?.on("data", (d: Buffer) => outputChannel.append(d.toString()));
      proc.stderr?.on("data", (d: Buffer) => outputChannel.append(d.toString()));
      proc.on("close", (code: number | null) => {
        if (code === 0) {
          outputChannel.appendLine(`\n✓ ${id} installed.`);
          this._onSdkPackagesChanged.fire();
          resolve();
        } else {
          reject(new Error(`sdkmanager exited with code ${code}`));
        }
      });
      proc.on("error", reject);
    });
  }

  uninstallPackage(id: string, outputChannel: vscode.OutputChannel): Promise<void> {
    const sdkPath = this.getSdkPath();
    if (!sdkPath) return Promise.reject(new Error("Android SDK not found."));
    outputChannel.show(true);
    outputChannel.appendLine(`Uninstalling ${id}…`);
    return uninstallSdkPackage(sdkPath, id).then(() => {
      outputChannel.appendLine(`✓ ${id} uninstalled.`);
      this._onSdkPackagesChanged.fire();
    });
  }

  updateAll(outputChannel: vscode.OutputChannel): Promise<void> {
    const sdkPath = this.getSdkPath();
    if (!sdkPath) return Promise.reject(new Error("Android SDK not found."));
    return new Promise((resolve, reject) => {
      outputChannel.show(true);
      outputChannel.appendLine("Updating all installed SDK packages…");
      const proc = updateAllSdkPackages(sdkPath);
      proc.stdout?.on("data", (d: Buffer) => outputChannel.append(d.toString()));
      proc.stderr?.on("data", (d: Buffer) => outputChannel.append(d.toString()));
      proc.on("close", (code: number | null) => {
        if (code === 0) {
          outputChannel.appendLine("\n✓ All packages updated.");
          this._onSdkPackagesChanged.fire();
          resolve();
        } else {
          reject(new Error(`sdkmanager --update exited with code ${code}`));
        }
      });
      proc.on("error", reject);
    });
  }

  async listAvds(): Promise<Avd[]> {
    const sdkPath = this.getSdkPath();
    if (!sdkPath) throw new Error("Android SDK not found. Configure androidDevkit.sdkPath.");
    return listAvds(sdkPath);
  }

  async listDeviceProfiles(): Promise<DeviceProfile[]> {
    const sdkPath = this.getSdkPath();
    if (!sdkPath) throw new Error("Android SDK not found.");
    return listDeviceProfiles(sdkPath);
  }

  async createAvd(opts: CreateAvdOptions): Promise<void> {
    const sdkPath = this.getSdkPath();
    if (!sdkPath) throw new Error("Android SDK not found.");
    await createAvd(sdkPath, opts);
    this._onAvdsChanged.fire();
  }

  async deleteAvd(name: string): Promise<void> {
    const sdkPath = this.getSdkPath();
    if (!sdkPath) throw new Error("Android SDK not found.");
    await deleteAvd(sdkPath, name);
    this._onAvdsChanged.fire();
  }

  launchAvd(name: string): void {
    const sdkPath = this.getSdkPath();
    if (!sdkPath) throw new Error("Android SDK not found.");
    launchAvd(sdkPath, name);
  }

  wipeAvdData(name: string): void {
    const sdkPath = this.getSdkPath();
    if (!sdkPath) throw new Error("Android SDK not found.");
    wipeAvdData(sdkPath, name);
  }

  isEmulatorRunning(runningSerials: string[]): boolean {
    return runningSerials.some((s) => s.startsWith("emulator-"));
  }

  dispose(): void {
    this._onSdkPackagesChanged.dispose();
    this._onAvdsChanged.dispose();
  }
}
