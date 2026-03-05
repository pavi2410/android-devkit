import * as vscode from "vscode";
import { DevicesTreeProvider } from "./views/devices";
import { LogcatTreeProvider } from "./views/logcat";
import { FileExplorerProvider } from "./views/file-explorer";
import { AvdManagerProvider } from "./views/avd-manager";
import { GradleTasksProvider } from "./views/gradle-tasks";
import { BuildRunProvider } from "./views/build-run";
import { ProjectLayoutProvider } from "./views/project-layout";
import { registerDeviceCommands } from "./commands/devices";
import { registerLogcatCommands } from "./commands/logcat";
import { registerSdkCommands } from "./commands/sdk";
import { registerAvdCommands } from "./commands/avd";
import { registerGradleCommands } from "./commands/gradle";
import { registerRunCommands } from "./commands/run";
import { AdbService } from "./services/adb";
import { SdkService } from "./services/sdk";
import { GradleService } from "./services/gradle";
import { SdkManagerPanel } from "./webviews/sdk-manager";
import { registerCommandMenu } from "./commands/command-menu";
import { applyTerminalEnv } from "./services/terminal-env";

let adbService: AdbService;
let sdkService: SdkService;
let gradleService: GradleService;

export function activate(context: vscode.ExtensionContext) {
  console.log("Android DevKit is now active!");

  // Initialize services
  sdkService = new SdkService();
  adbService = new AdbService(sdkService);
  gradleService = new GradleService();

  // Register tree views
  const devicesProvider = new DevicesTreeProvider(adbService);
  const logcatProvider = new LogcatTreeProvider(adbService);
  const fileExplorerProvider = new FileExplorerProvider(adbService);
  // SDK Manager is now a webview — no tree provider needed
  const avdManagerProvider = new AvdManagerProvider(sdkService, adbService);
  const gradleTasksProvider = new GradleTasksProvider(gradleService);
  const buildRunProvider = new BuildRunProvider(gradleService, adbService, context);
  const projectLayoutProvider = new ProjectLayoutProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("androidDevkit.devices", devicesProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.logcat", logcatProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.fileExplorer", fileExplorerProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.avdManager", avdManagerProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.gradleTasks", gradleTasksProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.buildRun", buildRunProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.projectLayout", projectLayoutProvider),
    vscode.commands.registerCommand("androidDevkit.refreshProjectLayout", () => {
      projectLayoutProvider.refresh();
    })
  );

  // Register commands
  registerDeviceCommands(context, adbService, devicesProvider, fileExplorerProvider);
  registerLogcatCommands(context, adbService, logcatProvider);
  registerSdkCommands(context, sdkService);
  registerAvdCommands(context, sdkService, avdManagerProvider);
  registerGradleCommands(context, gradleService, gradleTasksProvider);
  registerRunCommands(context, gradleService, adbService, buildRunProvider);
  registerCommandMenu(context);

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

  // SDK Manager page command
  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.openSdkManager", () => {
      SdkManagerPanel.show(context, sdkService);
    })
  );

  // Show walkthrough on first activation
  const hasShownWalkthrough = context.globalState.get<boolean>("walkthroughShown", false);
  if (!hasShownWalkthrough) {
    context.globalState.update("walkthroughShown", true);
    vscode.commands.executeCommand("workbench.action.openWalkthrough", "pavi2410.android-devkit#androidDevkit.getStarted");
  }

  // Command menu status bar button
  const commandMenuStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  commandMenuStatusBar.command = "androidDevkit.commandMenu";
  commandMenuStatusBar.text = "$(device-mobile) Android DevKit";
  commandMenuStatusBar.tooltip = "Open Android DevKit command menu";
  commandMenuStatusBar.show();
  context.subscriptions.push(commandMenuStatusBar);

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
          "Open Setup",
          "Set SDK Path",
          "Open Settings"
        );
        if (action === "Open Setup") {
          vscode.commands.executeCommand("androidDevkit.openSdkManager");
        } else if (action === "Set SDK Path") {
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

  // Inject Android SDK tool dirs into terminal PATH
  applyTerminalEnv(context.environmentVariableCollection, sdkService);

  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.addToTerminalPath", () => {
      const count = applyTerminalEnv(context.environmentVariableCollection, sdkService);
      if (count > 0) {
        vscode.window.showInformationMessage(
          `Android SDK tools added to terminal PATH (${count} director${count === 1 ? "y" : "ies"}).`
        );
      } else {
        vscode.window.showWarningMessage(
          "Android SDK not found. Configure androidDevkit.sdkPath first."
        );
      }
    })
  );

  // Auto-refresh devices on startup
  devicesProvider.refresh();
}

export function deactivate() {
  adbService?.dispose();
  sdkService?.dispose();
}
