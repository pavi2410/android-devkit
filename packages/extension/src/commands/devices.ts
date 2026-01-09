import * as vscode from "vscode";
import type { AdbService } from "../services/adb";
import type { DevicesTreeProvider, DeviceTreeItem } from "../views/devices";

export function registerDeviceCommands(
  context: vscode.ExtensionContext,
  adbService: AdbService,
  devicesProvider: DevicesTreeProvider
): void {
  // Refresh devices
  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.refreshDevices", () => {
      devicesProvider.refresh();
    })
  );

  // Connect device wirelessly
  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.connectDevice", async () => {
      const input = await vscode.window.showInputBox({
        prompt: "Enter device IP address and port",
        placeHolder: "192.168.1.100:5555",
        validateInput: (value) => {
          if (!value) return "Please enter an address";
          const parts = value.split(":");
          if (parts.length > 2) return "Invalid format. Use IP:PORT or just IP";
          return null;
        },
      });

      if (!input) return;

      const [host, portStr] = input.split(":");
      const port = portStr ? parseInt(portStr, 10) : 5555;

      try {
        const result = await adbService.connectWireless(host, port);
        if (result.includes("connected") || result.includes("already")) {
          vscode.window.showInformationMessage(`Connected to ${host}:${port}`);
          devicesProvider.refresh();
        } else {
          vscode.window.showWarningMessage(`Connection result: ${result}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to connect: ${message}`);
      }
    })
  );

  // Take screenshot
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "androidDevkit.takeScreenshot",
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService));
        if (!serial) return;

        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Taking screenshot...",
              cancellable: false,
            },
            async () => {
              const filePath = await adbService.takeScreenshot(serial);
              const uri = vscode.Uri.file(filePath);

              const action = await vscode.window.showInformationMessage(
                `Screenshot saved to ${filePath}`,
                "Open",
                "Show in Explorer"
              );

              if (action === "Open") {
                await vscode.commands.executeCommand("vscode.open", uri);
              } else if (action === "Show in Explorer") {
                await vscode.commands.executeCommand("revealFileInOS", uri);
              }
            }
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to take screenshot: ${message}`);
        }
      }
    )
  );

  // Reboot device
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "androidDevkit.rebootDevice",
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService));
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
}

/**
 * Show device picker if multiple devices connected
 */
async function selectDevice(adbService: AdbService): Promise<string | undefined> {
  const devices = await adbService.getDevices();

  if (devices.length === 0) {
    vscode.window.showWarningMessage("No devices connected");
    return undefined;
  }

  if (devices.length === 1) {
    return devices[0].serial;
  }

  const selected = await vscode.window.showQuickPick(
    devices.map((d) => ({
      label: d.name,
      description: d.serial,
      detail: `Android ${d.androidVersion} (API ${d.apiLevel})`,
      serial: d.serial,
    })),
    { placeHolder: "Select a device" }
  );

  return selected?.serial;
}
