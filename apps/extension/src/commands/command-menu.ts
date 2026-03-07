import * as vscode from "vscode";
import { ANDROID_DEVKIT_COMMANDS, VS_CODE_COMMANDS, type KnownCommandId } from "./ids";

interface CommandMenuItem extends vscode.QuickPickItem {
  command?: KnownCommandId;
}

export function registerCommandMenu(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.commandMenu, async () => {
      const items: CommandMenuItem[] = [
        {
          label: "$(device-mobile) Device Manager",
          description: "View and manage connected devices",
          command: ANDROID_DEVKIT_COMMANDS.focusDevices,
        },
        {
          label: "$(output) Logcat",
          description: "Stream device logs",
          command: ANDROID_DEVKIT_COMMANDS.focusLogcat,
        },
        {
          label: "$(package) SDK Manager",
          description: "Install and manage SDK packages",
          command: ANDROID_DEVKIT_COMMANDS.openSdkManager,
        },
        {
          label: "$(vm) Android Virtual Devices",
          description: "Create and manage Android virtual devices",
          command: ANDROID_DEVKIT_COMMANDS.focusAvdManager,
        },
        {
          label: "$(folder) Device File Explorer",
          description: "Browse files on device",
          command: ANDROID_DEVKIT_COMMANDS.focusFileExplorer,
        },
        { label: "", kind: vscode.QuickPickItemKind.Separator },
        {
          label: "$(play) Build & Run",
          description: "Build and deploy your app",
          command: ANDROID_DEVKIT_COMMANDS.focusBuildRun,
        },
        {
          label: "$(list-tree) Gradle Tasks",
          description: "Run Gradle tasks",
          command: ANDROID_DEVKIT_COMMANDS.focusGradleTasks,
        },
        { label: "", kind: vscode.QuickPickItemKind.Separator },
        {
          label: "$(gear) Extension Settings",
          description: "Configure Android DevKit",
          command: VS_CODE_COMMANDS.openSettings,
        },
        {
          label: "$(info) Show SDK Info",
          description: "View Android SDK path and details",
          command: ANDROID_DEVKIT_COMMANDS.showSdkInfo,
        },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        title: "Android DevKit",
        placeHolder: "Select an action",
        matchOnDescription: true,
      });

      if (selected?.command) {
        if (selected.command === VS_CODE_COMMANDS.openSettings) {
          vscode.commands.executeCommand(selected.command, "androidDevkit");
        } else {
          vscode.commands.executeCommand(selected.command);
        }
      }
    })
  );
}
