import * as vscode from "vscode";
import { SdkManagerPanel } from "../webviews/sdk-manager";
import type { AdbService } from "../services/adb";
import type { SdkService } from "../services/sdk";
import { applyTerminalEnv } from "../services/terminal-env";
import {
  ANDROID_DEVKIT_SETTINGS,
  openAndroidDevkitSetting,
  updateConfiguredSdkPath,
} from "../config/settings";
import type { FileExplorerProvider } from "../views/file-explorer";
import type { ProjectLayoutProvider } from "../views/project-layout";
import { ANDROID_DEVKIT_COMMANDS } from "./ids";

interface RegisterCoreCommandsOptions {
  adbService: AdbService;
  fileExplorerProvider: FileExplorerProvider;
  projectLayoutProvider: ProjectLayoutProvider;
  sdkService: SdkService;
}

async function promptForSdkPath(): Promise<string | undefined> {
  const uri = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    title: "Select Android SDK directory",
  });

  return uri && uri.length > 0 ? uri[0].fsPath : undefined;
}

async function updateSdkPath(fsPath: string): Promise<void> {
  await updateConfiguredSdkPath(fsPath);
  vscode.window.showInformationMessage("SDK path updated. Reload to apply.");
}

export function registerCoreCommands(
  context: vscode.ExtensionContext,
  options: RegisterCoreCommandsOptions
): void {
  const { adbService, fileExplorerProvider, projectLayoutProvider, sdkService } = options;

  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.refreshProjectLayout, () => {
      projectLayoutProvider.refresh();
    }),
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.refreshFileExplorer, () => {
      fileExplorerProvider.refresh();
    }),
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.pullFile, async (item) => {
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
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.pushFile, async (item) => {
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
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.deleteRemoteFile, async (item) => {
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
    }),
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.openSdkManager, () => {
      SdkManagerPanel.show(context, sdkService);
    }),
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.showSdkInfo, async () => {
      const currentSdk = adbService.getSdkPathPublic();
      if (currentSdk) {
        const action = await vscode.window.showInformationMessage(
          `Android SDK: ${currentSdk}`,
          "Change SDK Path",
          "Open Settings"
        );
        if (action === "Change SDK Path") {
          const selectedPath = await promptForSdkPath();
          if (selectedPath) {
            await updateSdkPath(selectedPath);
          }
        } else if (action === "Open Settings") {
          openAndroidDevkitSetting(ANDROID_DEVKIT_SETTINGS.sdkPath);
        }
        return;
      }

      const action = await vscode.window.showWarningMessage(
        "Android SDK not found. Set ANDROID_HOME or configure the SDK path.",
        "Open Setup",
        "Set SDK Path",
        "Open Settings"
      );

      if (action === "Open Setup") {
        vscode.commands.executeCommand(ANDROID_DEVKIT_COMMANDS.openSdkManager);
      } else if (action === "Set SDK Path") {
        const selectedPath = await promptForSdkPath();
        if (selectedPath) {
          await updateSdkPath(selectedPath);
        }
      } else if (action === "Open Settings") {
        openAndroidDevkitSetting(ANDROID_DEVKIT_SETTINGS.sdkPath);
      }
    }),
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.addToTerminalPath, () => {
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
}
