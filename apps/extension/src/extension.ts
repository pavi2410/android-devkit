import * as vscode from "vscode";
import { DevicesTreeProvider } from "./views/devices";
import { LogcatTreeProvider } from "./views/logcat";
import { FileExplorerProvider } from "./views/file-explorer";
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
  const fileExplorerProvider = new FileExplorerProvider(adbService);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("androidDevkit.devices", devicesProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.logcat", logcatProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.fileExplorer", fileExplorerProvider)
  );

  // Register commands
  registerDeviceCommands(context, adbService, devicesProvider, fileExplorerProvider);
  registerLogcatCommands(context, adbService, logcatProvider);

  // File explorer commands
  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.refreshFileExplorer", () => {
      fileExplorerProvider.refresh();
    }),
    vscode.commands.registerCommand("androidDevkit.pullFile", async (item) => {
      if (!item?.remotePath || !item?.deviceSerial) return;
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(item.file.name),
        title: "Save file as...",
      });
      if (!uri) return;
      try {
        await adbService.pullFile(item.deviceSerial, item.remotePath, uri.fsPath);
        vscode.window.showInformationMessage(`Pulled ${item.file.name}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to pull file: ${msg}`);
      }
    }),
    vscode.commands.registerCommand("androidDevkit.pushFile", async (item) => {
      if (!item?.remotePath || !item?.deviceSerial) return;
      const uris = await vscode.window.showOpenDialog({ title: "Select file to push" });
      if (!uris || uris.length === 0) return;
      const remoteDest = item.file.type === "directory"
        ? `${item.remotePath}/${uris[0].path.split("/").pop()}`
        : item.remotePath;
      try {
        await adbService.pushFile(item.deviceSerial, uris[0].fsPath, remoteDest);
        vscode.window.showInformationMessage(`Pushed to ${remoteDest}`);
        fileExplorerProvider.refresh();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to push file: ${msg}`);
      }
    }),
    vscode.commands.registerCommand("androidDevkit.deleteRemoteFile", async (item) => {
      if (!item?.remotePath || !item?.deviceSerial) return;
      const confirm = await vscode.window.showWarningMessage(
        `Delete ${item.remotePath}?`,
        { modal: true },
        "Delete"
      );
      if (confirm !== "Delete") return;
      try {
        const isDir = item.file.type === "directory";
        await adbService.deleteRemoteFile(item.deviceSerial, item.remotePath, isDir);
        vscode.window.showInformationMessage(`Deleted ${item.file.name}`);
        fileExplorerProvider.refresh();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to delete: ${msg}`);
      }
    })
  );

  // SDK status bar
  const sdkPath = adbService.getSdkPathPublic();
  const sdkStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  sdkStatusBar.command = "androidDevkit.showSdkInfo";
  if (sdkPath) {
    sdkStatusBar.text = "$(check) Android SDK";
    sdkStatusBar.tooltip = `Android SDK: ${sdkPath}`;
  } else {
    sdkStatusBar.text = "$(warning) Android SDK not found";
    sdkStatusBar.tooltip = "Click to configure Android SDK path";
  }
  sdkStatusBar.show();
  context.subscriptions.push(sdkStatusBar);

  // Show SDK info command
  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.showSdkInfo", async () => {
      const currentSdk = adbService.getSdkPathPublic();
      if (currentSdk) {
        const action = await vscode.window.showInformationMessage(
          `Android SDK: ${currentSdk}`,
          "Change SDK Path",
          "Open Settings"
        );
        if (action === "Change SDK Path") {
          const uri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            title: "Select Android SDK directory",
          });
          if (uri && uri.length > 0) {
            await vscode.workspace.getConfiguration("androidDevkit").update("sdkPath", uri[0].fsPath, true);
            vscode.window.showInformationMessage("SDK path updated. Reload to apply.");
          }
        } else if (action === "Open Settings") {
          vscode.commands.executeCommand("workbench.action.openSettings", "androidDevkit.sdkPath");
        }
      } else {
        const action = await vscode.window.showWarningMessage(
          "Android SDK not found. Set ANDROID_HOME or configure the SDK path.",
          "Set SDK Path",
          "Open Settings"
        );
        if (action === "Set SDK Path") {
          const uri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            title: "Select Android SDK directory",
          });
          if (uri && uri.length > 0) {
            await vscode.workspace.getConfiguration("androidDevkit").update("sdkPath", uri[0].fsPath, true);
            vscode.window.showInformationMessage("SDK path updated. Reload to apply.");
          }
        } else if (action === "Open Settings") {
          vscode.commands.executeCommand("workbench.action.openSettings", "androidDevkit.sdkPath");
        }
      }
    })
  );

  // Auto-refresh devices on startup
  devicesProvider.refresh();
}

export function deactivate() {
  // Cleanup
  adbService?.dispose();
}
