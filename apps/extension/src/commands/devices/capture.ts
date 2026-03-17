import * as vscode from "vscode";
import type { AdbService } from "../../services/adb";
import type { ScrcpyService } from "../../services/scrcpy";
import type { DeviceTreeItem } from "../../views/devices";
import { ScrcpyPanel } from "../../webviews/scrcpy";
import { ANDROID_DEVKIT_COMMANDS, VS_CODE_COMMANDS } from "../ids";
import { copyImageToClipboard } from "../../utils/clipboard";
import { selectDevice } from "./select-device";

export function registerCaptureCommands(
  context: vscode.ExtensionContext,
  adbService: AdbService,
  scrcpyService: ScrcpyService
): void {
  // Take screenshot
  context.subscriptions.push(
    vscode.commands.registerCommand(
      ANDROID_DEVKIT_COMMANDS.takeScreenshot,
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService, context));
        if (!serial) return;

        try {
          const filePath = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Taking screenshot...",
              cancellable: false,
            },
            () => adbService.takeScreenshot(serial)
          );

          const uri = vscode.Uri.file(filePath);
          const action = await vscode.window.showInformationMessage(
            `Screenshot saved to ${filePath}`,
            "Open",
            "Show in Explorer",
            "Copy to Clipboard"
          );

          if (action === "Open") {
            await vscode.commands.executeCommand(VS_CODE_COMMANDS.open, uri);
          } else if (action === "Show in Explorer") {
            await vscode.commands.executeCommand(VS_CODE_COMMANDS.revealFileInOs, uri);
          } else if (action === "Copy to Clipboard") {
            await copyImageToClipboard(filePath);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to take screenshot: ${message}`);
        }
      }
    )
  );

  // Record screen
  context.subscriptions.push(
    vscode.commands.registerCommand(
      ANDROID_DEVKIT_COMMANDS.recordScreen,
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService, context));
        if (!serial) return;

        const duration = await vscode.window.showQuickPick(
          [
            { label: "10 seconds", value: 10 },
            { label: "30 seconds", value: 30 },
            { label: "60 seconds", value: 60 },
            { label: "3 minutes (max)", value: 180 },
          ],
          { placeHolder: "Select recording duration" }
        );

        if (!duration) return;

        try {
          const filePath = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Recording screen (${duration.label})...`,
              cancellable: false,
            },
            async () => {
              return adbService.recordScreen(serial, duration.value);
            }
          );

          const uri = vscode.Uri.file(filePath);
          const action = await vscode.window.showInformationMessage(
            `Screen recording saved to ${filePath}`,
            "Open",
            "Show in Explorer"
          );

          if (action === "Open") {
            await vscode.commands.executeCommand(VS_CODE_COMMANDS.open, uri);
          } else if (action === "Show in Explorer") {
            await vscode.commands.executeCommand(VS_CODE_COMMANDS.revealFileInOs, uri);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to record screen: ${message}`);
        }
      }
    )
  );

  // Reboot device
  context.subscriptions.push(
    vscode.commands.registerCommand(
      ANDROID_DEVKIT_COMMANDS.rebootDevice,
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService, context));
        if (!serial) return;

        const mode = await vscode.window.showQuickPick(
          [
            { label: "Normal Reboot", description: "Restart the device normally", value: undefined },
            { label: "Bootloader", description: "Reboot to bootloader/fastboot", value: "bootloader" as const },
            { label: "Recovery", description: "Reboot to recovery mode", value: "recovery" as const },
          ],
          { placeHolder: "Select reboot mode" }
        );

        if (!mode) return;

        const confirm = await vscode.window.showWarningMessage(
          `Reboot device ${serial}?`,
          { modal: true },
          "Reboot"
        );

        if (confirm !== "Reboot") return;

        try {
          await adbService.rebootDevice(serial, mode.value);
          vscode.window.showInformationMessage(`Rebooting device...`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to reboot: ${message}`);
        }
      }
    )
  );

  // Mirror screen
  context.subscriptions.push(
    vscode.commands.registerCommand(
      ANDROID_DEVKIT_COMMANDS.mirrorScreen,
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService, context));
        if (!serial) return;

        const deviceName = item?.device?.name ?? serial;
        ScrcpyPanel.show(context, scrcpyService, serial, deviceName);
      }
    )
  );
}
