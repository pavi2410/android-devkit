import * as vscode from "vscode";
import type { AdbService } from "../../services/adb";
import type { DeviceTreeItem } from "../../views/devices";
import type { FileExplorerProvider } from "../../views/file-explorer";
import { ANDROID_DEVKIT_COMMANDS } from "../ids";
import { promptForAndroidAppPackage } from "../../utils/android-app";
import { selectDevice } from "./select-device";

export function registerInteractionCommands(
  context: vscode.ExtensionContext,
  adbService: AdbService,
  fileExplorerProvider: FileExplorerProvider
): void {
  // Open ADB shell in terminal
  context.subscriptions.push(
    vscode.commands.registerCommand(
      ANDROID_DEVKIT_COMMANDS.openShell,
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService, context));
        if (!serial) return;

        const adbPath = adbService.getAdbPathPublic();
        const deviceName = item?.device?.name ?? serial;

        const terminal = vscode.window.createTerminal({
          name: `ADB Shell: ${deviceName}`,
          shellPath: adbPath,
          shellArgs: ["-s", serial, "shell"],
          iconPath: new vscode.ThemeIcon("terminal"),
        });
        terminal.show();
      }
    )
  );

  // Browse device files
  context.subscriptions.push(
    vscode.commands.registerCommand(
      ANDROID_DEVKIT_COMMANDS.browseFiles,
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService, context));
        if (!serial) return;

        fileExplorerProvider.setDevice(serial);
        vscode.commands.executeCommand(ANDROID_DEVKIT_COMMANDS.focusFileExplorer);
      }
    )
  );

  // Test deep link
  context.subscriptions.push(
    vscode.commands.registerCommand(
      ANDROID_DEVKIT_COMMANDS.testDeepLink,
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService, context));
        if (!serial) return;

        const uri = await vscode.window.showInputBox({
          prompt: "Enter a deep link URI to launch on device",
          placeHolder: "https://example.com/path or myapp://screen",
          validateInput: (value) => {
            if (!value) return "Please enter a URI";
            if (!value.includes("://")) return "URI must contain a scheme (e.g. https:// or myapp://)";
            return null;
          },
        });

        if (!uri) return;

        try {
          await adbService.launchDeepLink(serial, uri);
          vscode.window.showInformationMessage(`Launched deep link: ${uri}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to launch deep link: ${message}`);
        }
      }
    )
  );

  // Manage app permissions
  context.subscriptions.push(
    vscode.commands.registerCommand(
      ANDROID_DEVKIT_COMMANDS.managePermissions,
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService, context));
        if (!serial) return;

        const packageName = await promptForAndroidAppPackage();
        if (!packageName) return;

        const permissions = await adbService.getAppPermissions(serial, packageName);
        if (permissions.length === 0) {
          vscode.window.showInformationMessage(`No runtime permissions found for ${packageName}`);
          return;
        }

        const items = permissions.map((p) => ({
          label: p.permission.replace("android.permission.", ""),
          description: p.granted ? "$(check) Granted" : "$(close) Denied",
          detail: p.permission,
          permission: p.permission,
          granted: p.granted,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: "Select a permission to toggle",
          title: `Permissions for ${packageName}`,
        });

        if (!selected) return;

        try {
          if (selected.granted) {
            await adbService.revokePermission(serial, packageName, selected.permission);
            vscode.window.showInformationMessage(`Revoked ${selected.label}`);
          } else {
            await adbService.grantPermission(serial, packageName, selected.permission);
            vscode.window.showInformationMessage(`Granted ${selected.label}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to update permission: ${message}`);
        }
      }
    )
  );
}
