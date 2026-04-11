import * as vscode from "vscode";
import { ServiceContainer } from "./services/container";
import { registerDeviceFeature } from "./features/devices";
import { registerLogcatFeature } from "./features/logcat";
import { registerBuildRunFeature } from "./features/build-run";
import { registerAvdFeature } from "./features/avd";
import { registerGradleFeature } from "./features/gradle";
import { registerSdkFeature } from "./features/sdk";
import { registerProjectFeature } from "./features/project";
import { registerAdbStatusFeature } from "./features/adb-status";
import { registerCommandMenu } from "./commands/command-menu";
import { ANDROID_DEVKIT_COMMANDS, VS_CODE_COMMANDS } from "./commands/ids";

export function activate(context: vscode.ExtensionContext) {
  console.log("Android DevKit is now active!");

  const services = new ServiceContainer(context.extensionUri);
  context.subscriptions.push(services);

  // Register features
  registerAdbStatusFeature(context, services);
  const fileExplorerProvider = registerDeviceFeature(context, services);
  registerLogcatFeature(context, services);
  registerBuildRunFeature(context, services);
  registerAvdFeature(context, services);
  registerGradleFeature(context, services);
  registerSdkFeature(context, services);
  registerProjectFeature(context, services, fileExplorerProvider);
  registerCommandMenu(context);

  // Show walkthrough on first activation
  const hasShownWalkthrough = context.globalState.get<boolean>("walkthroughShown", false);
  if (!hasShownWalkthrough) {
    context.globalState.update("walkthroughShown", true);
    vscode.commands.executeCommand(VS_CODE_COMMANDS.openWalkthrough, "pavi2410.android-devkit#androidDevkit.getStarted");
  }

  vscode.commands.executeCommand(ANDROID_DEVKIT_COMMANDS.addToTerminalPath);
}

export function deactivate() {
  // ServiceContainer disposal is handled by context.subscriptions
}
