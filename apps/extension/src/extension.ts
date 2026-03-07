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
import { ANDROID_DEVKIT_COMMANDS, CONTEXT_KEYS, VS_CODE_COMMANDS } from "./commands/ids";
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

  const targetDeviceStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 49);
  targetDeviceStatusBar.command = ANDROID_DEVKIT_COMMANDS.selectRunTarget;
  targetDeviceStatusBar.name = "Android DevKit Target Device";

  const buildVariantStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 48);
  buildVariantStatusBar.command = ANDROID_DEVKIT_COMMANDS.selectBuildVariant;
  buildVariantStatusBar.name = "Android DevKit Build Variant";

  const logcatStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 47);
  logcatStatusBar.command = ANDROID_DEVKIT_COMMANDS.logcatStatusMenu;
  logcatStatusBar.name = "Android DevKit Logcat";

  const updateBuildVariantStatusBar = () => {
    const variant = buildRunProvider.getSelectedVariant()?.name ?? "Select Variant";
    buildVariantStatusBar.text = `$(symbol-enum) ${variant}`;
    buildVariantStatusBar.tooltip = "Select Android build variant";
    buildVariantStatusBar.show();
  };

  const updateTargetDeviceStatusBar = () => {
    const target = buildRunProvider.getSelectedDeviceLabel() ?? "Select Target";
    targetDeviceStatusBar.text = `$(device-mobile) ${target}`;
    targetDeviceStatusBar.tooltip = "Select target device or emulator";
    targetDeviceStatusBar.show();
  };

  const updateLogcatStatusBar = () => {
    const session = logcatProvider.getSession();
    const state = logcatProvider.getSessionState();
    const stateLabel = state.charAt(0).toUpperCase() + state.slice(1);
    const detail = session.deviceLabel ?? session.serial ?? "Choose device";
    logcatStatusBar.text = `$(output) Logcat: ${stateLabel}`;
    logcatStatusBar.tooltip = session.packageName
      ? `Logcat ${stateLabel} — ${detail} — ${session.packageName}`
      : `Logcat ${stateLabel} — ${detail}`;
  };

  const refreshAvdWelcomeState = async () => {
    const sdkConfigured = Boolean(sdkService.getSdkPath());
    await vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, CONTEXT_KEYS.sdkConfigured, sdkConfigured);

    if (!sdkConfigured) {
      await vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, CONTEXT_KEYS.hasAvds, false);
      return;
    }

    try {
      const avds = await sdkService.listAvds();
      await vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, CONTEXT_KEYS.hasAvds, avds.length > 0);
    } catch {
      await vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, CONTEXT_KEYS.hasAvds, false);
    }
  };

  const refreshDeviceDerivedUi = async () => {
    try {
      const devices = await adbService.getDevices();
      await vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, CONTEXT_KEYS.hasDevices, devices.length > 0);

      const readyDevices = devices.filter((device) => device.state === "device");
      const readySerials = new Set(readyDevices.map((device) => device.serial));

      logcatProvider.setHasAvailableDevices(readyDevices.length > 0);
      updateLogcatStatusBar();

      if (readyDevices.length > 0) {
        logcatStatusBar.show();
      } else {
        logcatStatusBar.hide();
      }

      const selectedTarget = buildRunProvider.getSelectedDeviceSerial();
      if (selectedTarget && !readySerials.has(selectedTarget)) {
        await buildRunProvider.setDevice("", "Select Target");
      }

      const fileExplorerDevice = fileExplorerProvider.getCurrentDevice();
      if (fileExplorerDevice && !readySerials.has(fileExplorerDevice)) {
        fileExplorerProvider.clearDevice();
      }
    } catch {
      await vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, CONTEXT_KEYS.hasDevices, false);
      logcatProvider.setHasAvailableDevices(false);
      logcatStatusBar.hide();
    }

    updateTargetDeviceStatusBar();
  };

  context.subscriptions.push(
    logcatService,
    buildRunProvider,
    projectLayoutProvider,
    vscode.window.registerTreeDataProvider("androidDevkit.devices", devicesProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.logcat", logcatProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.fileExplorer", fileExplorerProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.avdManager", avdManagerProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.gradleTasks", gradleTasksProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.buildRun", buildRunProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.projectLayout", projectLayoutProvider),
    targetDeviceStatusBar,
    buildVariantStatusBar,
    logcatStatusBar,
    buildRunProvider.onDidSelectionChange(() => {
      updateBuildVariantStatusBar();
      updateTargetDeviceStatusBar();
    }),
    logcatProvider.onDidSessionChange(() => {
      updateLogcatStatusBar();
    }),
    adbService.onDevicesChanged(() => {
      void refreshDeviceDerivedUi();
    }),
    sdkService.onAvdsChanged(() => {
      void refreshAvdWelcomeState();
    })
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

  vscode.commands.executeCommand(ANDROID_DEVKIT_COMMANDS.addToTerminalPath);

  // Auto-refresh devices on startup
  void buildRunProvider.ensureInitialized().finally(() => {
    updateBuildVariantStatusBar();
    updateTargetDeviceStatusBar();
  });
  void refreshAvdWelcomeState();
  void refreshDeviceDerivedUi();
  updateLogcatStatusBar();
  devicesProvider.refresh();
}

export function deactivate() {
  logcatService?.dispose();
  adbService?.dispose();
  sdkService?.dispose();
}
