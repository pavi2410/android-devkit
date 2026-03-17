import * as vscode from "vscode";
import type { AdbService } from "../../services/adb";
import type { ScrcpyService } from "../../services/scrcpy";
import type { DevicesTreeProvider } from "../../views/devices";
import type { FileExplorerProvider } from "../../views/file-explorer";
import { registerConnectionCommands } from "./connection";
import { registerInteractionCommands } from "./interaction";
import { registerCaptureCommands } from "./capture";

export { selectDevice } from "./select-device";

export function registerDeviceCommands(
  context: vscode.ExtensionContext,
  adbService: AdbService,
  scrcpyService: ScrcpyService,
  devicesProvider: DevicesTreeProvider,
  fileExplorerProvider: FileExplorerProvider
): void {
  registerConnectionCommands(context, adbService, devicesProvider);
  registerInteractionCommands(context, adbService, fileExplorerProvider);
  registerCaptureCommands(context, adbService, scrcpyService);
}
