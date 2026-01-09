import * as vscode from "vscode";
import { DevicesTreeProvider } from "./views/devices";
import { LogcatTreeProvider } from "./views/logcat";
import { registerDeviceCommands } from "./commands/devices";
import { registerLogcatCommands } from "./commands/logcat";
import { AdbService } from "./services/adb";

let adbService: AdbService;

export function activate(context: vscode.ExtensionContext) {
  console.log("Android DevKit is now active!");

  // Initialize ADB service
  adbService = new AdbService();

  // Register tree views
  const devicesProvider = new DevicesTreeProvider(adbService);
  const logcatProvider = new LogcatTreeProvider(adbService);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("androidDevkit.devices", devicesProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.logcat", logcatProvider)
  );

  // Register commands
  registerDeviceCommands(context, adbService, devicesProvider);
  registerLogcatCommands(context, adbService, logcatProvider);

  // Auto-refresh devices on startup
  devicesProvider.refresh();
}

export function deactivate() {
  // Cleanup
  adbService?.dispose();
}
