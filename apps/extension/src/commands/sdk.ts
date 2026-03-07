import * as vscode from "vscode";
import type { SdkService } from "../services/sdk";
import { ANDROID_DEVKIT_COMMANDS } from "./ids";

export function registerSdkCommands(
  context: vscode.ExtensionContext,
  sdkService: SdkService
): void {
  const outputChannel = vscode.window.createOutputChannel("ADK: SDK Manager");
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.installSdkPackage, async (idArg?: string) => {
      const id = idArg ?? await vscode.window.showInputBox({
        title: "Install SDK Package",
        prompt: "Enter the package ID (e.g. platforms;android-35)",
        placeHolder: "platforms;android-35",
      });

      if (!id) return;

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `Installing ${id}…`, cancellable: false },
          () => sdkService.installPackage(id!, outputChannel)
        );
        vscode.window.showInformationMessage(`✓ ${id} installed successfully.`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to install ${id}: ${msg}`);
      }
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.uninstallSdkPackage, async (idArg?: string) => {
      const id = idArg ?? await vscode.window.showInputBox({
        title: "Uninstall SDK Package",
        prompt: "Enter the package ID to uninstall",
      });
      if (!id) return;

      const confirm = await vscode.window.showWarningMessage(
        `Uninstall ${id}?`,
        { modal: true },
        "Uninstall"
      );
      if (confirm !== "Uninstall") return;

      try {
        await sdkService.uninstallPackage(id, outputChannel);
        vscode.window.showInformationMessage(`✓ ${id} uninstalled.`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to uninstall ${id}: ${msg}`);
      }
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.updateAllSdkPackages, async () => {
      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: "Updating SDK packages…", cancellable: false },
          () => sdkService.updateAll(outputChannel)
        );
        vscode.window.showInformationMessage("✓ All SDK packages updated.");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to update SDK packages: ${msg}`);
      }
    })
  );
}
