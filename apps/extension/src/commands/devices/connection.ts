import * as vscode from "vscode";
import type { AdbService } from "../../services/adb";
import type { DevicesTreeProvider, DeviceTreeItem } from "../../views/devices";
import { ANDROID_DEVKIT_COMMANDS } from "../ids";
import { selectDevice } from "./select-device";

export function registerConnectionCommands(
  context: vscode.ExtensionContext,
  adbService: AdbService,
  devicesProvider: DevicesTreeProvider
): void {
  // Refresh devices
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.refreshDevices, () => {
      devicesProvider.refresh();
    })
  );

  // Connect device wirelessly (TCP/IP)
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.connectDevice, async () => {
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
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.pairDevice, async () => {
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
      ANDROID_DEVKIT_COMMANDS.enableTcpip,
      async (item?: DeviceTreeItem) => {
        const serial = item?.device?.serial ?? (await selectDevice(adbService, context));
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
}
