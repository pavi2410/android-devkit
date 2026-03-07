import * as vscode from "vscode";
import { resolveAndroidSdkPath } from "@android-devkit/android-sdk";
import {
  getSdkManagerPath,
  listSdkPackages,
  installSdkPackage,
  uninstallSdkPackage,
  updateAllSdkPackages,
  type SdkPackage,
} from "@android-devkit/sdkmanager";
import {
  getAvdManagerPath,
  listAvds,
  listDeviceProfiles,
  createAvd,
  deleteAvd,
  type Avd,
  type AvdServices,
  type DeviceProfile,
  type CreateAvdOptions,
} from "@android-devkit/avdmanager";
import {
  getEmulatorPath,
  launchAvd,
  wipeAvdData,
} from "@android-devkit/emulator";

export type { SdkPackage, Avd, AvdServices, DeviceProfile, CreateAvdOptions };

export class SdkService {
  private _onSdkPackagesChanged = new vscode.EventEmitter<void>();
  private _onAvdsChanged = new vscode.EventEmitter<void>();

  readonly onSdkPackagesChanged = this._onSdkPackagesChanged.event;
  readonly onAvdsChanged = this._onAvdsChanged.event;
 
  getSdkPath(): string | undefined {
    const config = vscode.workspace.getConfiguration("androidDevkit");
    return resolveAndroidSdkPath({ configuredPath: config.get<string>("sdkPath") });
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
    outputChannel.show(true);
    outputChannel.appendLine(`Installing ${id}…`);
    const command = installSdkPackage(sdkPath, id);
    command.process.stdout?.on("data", (d: Buffer) => outputChannel.append(d.toString()));
    command.process.stderr?.on("data", (d: Buffer) => outputChannel.append(d.toString()));

    return command.result.then(({ exitCode }) => {
      if (exitCode === 0) {
        outputChannel.appendLine(`\n✓ ${id} installed.`);
        this._onSdkPackagesChanged.fire();
        return;
      }

      throw new Error(`sdkmanager exited with code ${exitCode}`);
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
    outputChannel.show(true);
    outputChannel.appendLine("Updating all installed SDK packages…");
    const command = updateAllSdkPackages(sdkPath);
    command.process.stdout?.on("data", (d: Buffer) => outputChannel.append(d.toString()));
    command.process.stderr?.on("data", (d: Buffer) => outputChannel.append(d.toString()));

    return command.result.then(({ exitCode }) => {
      if (exitCode === 0) {
        outputChannel.appendLine("\n✓ All packages updated.");
        this._onSdkPackagesChanged.fire();
        return;
      }

      throw new Error(`sdkmanager --update exited with code ${exitCode}`);
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
