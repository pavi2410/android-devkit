import * as vscode from "vscode";
import type { SdkService } from "../services/sdk";
import type { SdkManagerProvider } from "../views/sdk-manager";
import { PackageItem } from "../views/sdk-manager";

export function registerSdkCommands(
  context: vscode.ExtensionContext,
  sdkService: SdkService,
  sdkManagerProvider: SdkManagerProvider
): void {
  const outputChannel = vscode.window.createOutputChannel("Android SDK Manager");
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.refreshSdkPackages", () => {
      sdkManagerProvider.refresh();
    }),

    vscode.commands.registerCommand("androidDevkit.installSdkPackage", async (item?: PackageItem) => {
      let id: string | undefined;

      if (item instanceof PackageItem) {
        id = item.pkg.id;
      } else {
        id = await vscode.window.showInputBox({
          title: "Install SDK Package",
          prompt: "Enter the package ID (e.g. platforms;android-35)",
          placeHolder: "platforms;android-35",
        });
      }

      if (!id) return;

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `Installing ${id}…`, cancellable: false },
          () => sdkService.installPackage(id!, outputChannel)
        );
        vscode.window.showInformationMessage(`✓ ${id} installed successfully.`);
        sdkManagerProvider.refresh();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to install ${id}: ${msg}`);
      }
    }),

    vscode.commands.registerCommand("androidDevkit.uninstallSdkPackage", async (item?: PackageItem) => {
      if (!(item instanceof PackageItem)) return;
      const { id } = item.pkg;

      const confirm = await vscode.window.showWarningMessage(
        `Uninstall ${item.pkg.displayName} (${id})?`,
        { modal: true },
        "Uninstall"
      );
      if (confirm !== "Uninstall") return;

      try {
        await sdkService.uninstallPackage(id, outputChannel);
        vscode.window.showInformationMessage(`✓ ${id} uninstalled.`);
        sdkManagerProvider.refresh();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to uninstall ${id}: ${msg}`);
      }
    }),

    vscode.commands.registerCommand("androidDevkit.updateAllSdkPackages", async () => {
      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: "Updating SDK packages…", cancellable: false },
          () => sdkService.updateAll(outputChannel)
        );
        vscode.window.showInformationMessage("✓ All SDK packages updated.");
        sdkManagerProvider.refresh();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to update SDK packages: ${msg}`);
      }
    })
  );
}
