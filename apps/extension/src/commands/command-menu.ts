import * as vscode from "vscode";

interface CommandMenuItem extends vscode.QuickPickItem {
  command?: string;
}

export function registerCommandMenu(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.commandMenu", async () => {
      const items: CommandMenuItem[] = [
        {
          label: "$(device-mobile) Device Manager",
          description: "View and manage connected devices",
          command: "androidDevkit.devices.focus",
        },
        {
          label: "$(output) Logcat",
          description: "Stream device logs",
          command: "androidDevkit.logcat.focus",
        },
        {
          label: "$(package) SDK Manager",
          description: "Install and manage SDK packages",
          command: "androidDevkit.openSdkManager",
        },
        {
          label: "$(vm) AVD Manager",
          description: "Manage virtual devices",
          command: "androidDevkit.avdManager.focus",
        },
        {
          label: "$(folder) Device File Explorer",
          description: "Browse files on device",
          command: "androidDevkit.fileExplorer.focus",
        },
        { label: "", kind: vscode.QuickPickItemKind.Separator },
        {
          label: "$(play) Build & Run",
          description: "Build and deploy your app",
          command: "androidDevkit.buildRun.focus",
        },
        {
          label: "$(list-tree) Gradle Tasks",
          description: "Run Gradle tasks",
          command: "androidDevkit.gradleTasks.focus",
        },
        { label: "", kind: vscode.QuickPickItemKind.Separator },
        {
          label: "$(gear) Extension Settings",
          description: "Configure Android DevKit",
          command: "workbench.action.openSettings",
        },
        {
          label: "$(info) Show SDK Info",
          description: "View Android SDK path and details",
          command: "androidDevkit.showSdkInfo",
        },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        title: "Android DevKit",
        placeHolder: "Select an action",
        matchOnDescription: true,
      });

      if (selected?.command) {
        if (selected.command === "workbench.action.openSettings") {
          vscode.commands.executeCommand(selected.command, "androidDevkit");
        } else {
          vscode.commands.executeCommand(selected.command);
        }
      }
    })
  );
}
