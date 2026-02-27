import * as vscode from "vscode";
import type { AdbService } from "../services/adb";
import type { DevicesTreeProvider, DeviceTreeItem } from "../views/devices";
import type { FileExplorerProvider } from "../views/file-explorer";

export function registerDeviceCommands(
  context: vscode.ExtensionContext,
  adbService: AdbService,
  devicesProvider: DevicesTreeProvider,
  fileExplorerProvider: FileExplorerProvider
): void {
  // Refresh devices
  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.refreshDevices", () => {
      devicesProvider.refresh();
    })
  );

  // Connect device wirelessly (TCP/IP)
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

  // Pair device for wireless debugging (Android 11+)
  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.pairDevice", async () => {
      const hostInput = await vscode.window.showInputBox({
        prompt: "Enter device IP address and pairing port",
        placeHolder: "192.168.1.100:37000",
        validateInput: (value) => {
          if (!value) return "Please enter an address";
          if (!value.includes(":")) return "Port is required for pairing (IP:PORT)";
          return null;
        },
      });

      if (!hostInput) return;

      const [host, portStr] = hostInput.split(":");
      const port = parseInt(portStr, 10);

      const pairingCode = await vscode.window.showInputBox({
        prompt: "Enter the 6-digit pairing code shown on the device",
        placeHolder: "123456",
        validateInput: (value) => {
          if (!value || value.length < 6) return "Enter the pairing code from the device";
          return null;
        },
      });

      if (!pairingCode) return;

      try {
        const result = await adbService.pairDevice(host, port, pairingCode);
        if (result.toLowerCase().includes("success")) {
          vscode.window.showInformationMessage(`Paired with device at ${host}:${port}`);
          devicesProvider.refresh();
        } else {
          vscode.window.showWarningMessage(`Pairing result: ${result}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to pair: ${message}`);
      }
    })
  );

  // Enable TCP/IP mode on USB device
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "androidDevkit.enableTcpip",
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService));
        if (!serial) return;

        try {
          await adbService.enableTcpip(serial);
          vscode.window.showInformationMessage(
            `TCP/IP mode enabled on ${serial}. You can now disconnect USB and connect via IP:5555.`
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(`Failed to enable TCP/IP: ${message}`);
        }
      }
    )
  );

  // Open ADB shell in terminal
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "androidDevkit.openShell",
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService));
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
      "androidDevkit.browseFiles",
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService));
        if (!serial) return;

        fileExplorerProvider.setDevice(serial);
        vscode.commands.executeCommand("androidDevkit.fileExplorer.focus");
      }
    )
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
