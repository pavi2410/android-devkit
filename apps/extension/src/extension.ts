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
import { registerCoreCommands } from "./commands/core";
import { ANDROID_DEVKIT_COMMANDS, VS_CODE_COMMANDS } from "./commands/ids";
import { AdbService } from "./services/adb";
import { SdkService } from "./services/sdk";
import { GradleService } from "./services/gradle";
import { LogcatService } from "./services/logcat";
import { registerCommandMenu } from "./commands/command-menu";

let adbService: AdbService;
let logcatService: LogcatService;
let sdkService: SdkService;
let gradleService: GradleService;

export function activate(context: vscode.ExtensionContext) {
  console.log("Android DevKit is now active!");

  // Initialize services
  sdkService = new SdkService();
  adbService = new AdbService(sdkService);
  logcatService = new LogcatService(adbService);
  gradleService = new GradleService();

  // Register tree views
  const devicesProvider = new DevicesTreeProvider(adbService);
  const logcatProvider = new LogcatTreeProvider(logcatService);
  const fileExplorerProvider = new FileExplorerProvider(adbService);
  // SDK Manager is now a webview — no tree provider needed
  const avdManagerProvider = new AvdManagerProvider(sdkService, adbService);
  const gradleTasksProvider = new GradleTasksProvider(gradleService);
  const buildRunProvider = new BuildRunProvider(gradleService, adbService, context);
  const projectLayoutProvider = new ProjectLayoutProvider();

  context.subscriptions.push(
    logcatService,
    vscode.window.registerTreeDataProvider("androidDevkit.devices", devicesProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.logcat", logcatProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.fileExplorer", fileExplorerProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.avdManager", avdManagerProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.gradleTasks", gradleTasksProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.buildRun", buildRunProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.projectLayout", projectLayoutProvider)
  );

  // Register commands
  registerCoreCommands(context, {
    adbService,
    fileExplorerProvider,
    projectLayoutProvider,
    sdkService,
  });
  registerDeviceCommands(context, adbService, devicesProvider, fileExplorerProvider);
  registerLogcatCommands(context, adbService, logcatProvider);
  registerSdkCommands(context, sdkService);
  registerAvdCommands(context, sdkService, avdManagerProvider);
  registerGradleCommands(context, gradleService, gradleTasksProvider);
  registerRunCommands(context, gradleService, adbService, buildRunProvider);
  registerCommandMenu(context);

  // Show walkthrough on first activation
  const hasShownWalkthrough = context.globalState.get<boolean>("walkthroughShown", false);
  if (!hasShownWalkthrough) {
    context.globalState.update("walkthroughShown", true);
    vscode.commands.executeCommand(VS_CODE_COMMANDS.openWalkthrough, "pavi2410.android-devkit#androidDevkit.getStarted");
  }

  // Command menu status bar button
  const commandMenuStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  commandMenuStatusBar.command = ANDROID_DEVKIT_COMMANDS.commandMenu;
  commandMenuStatusBar.text = "$(device-mobile) Android DevKit";
  commandMenuStatusBar.tooltip = "Open Android DevKit command menu";
  commandMenuStatusBar.show();
  context.subscriptions.push(commandMenuStatusBar);

  vscode.commands.executeCommand(ANDROID_DEVKIT_COMMANDS.addToTerminalPath);

  // Auto-refresh devices on startup
  devicesProvider.refresh();
}

export function deactivate() {
  logcatService?.dispose();
  adbService?.dispose();
  sdkService?.dispose();
}
