import * as vscode from "vscode";
import type { AdbService } from "../services/adb";
import type { DevicesTreeProvider, DeviceTreeItem } from "../views/devices";
import type { FileExplorerProvider } from "../views/file-explorer";
import { ANDROID_DEVKIT_COMMANDS, VS_CODE_COMMANDS } from "./ids";
import { copyImageToClipboard } from "../utils/clipboard";
import { promptForAndroidAppPackage } from "../utils/android-app";

export function registerDeviceCommands(
  context: vscode.ExtensionContext,
  adbService: AdbService,
  devicesProvider: DevicesTreeProvider,
  fileExplorerProvider: FileExplorerProvider
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

/**
 * Show device picker if multiple devices connected
 */
export async function selectDevice(adbService: AdbService, context?: vscode.ExtensionContext): Promise<string | undefined> {
  const devices = await adbService.getDevices();

  if (devices.length === 0) {
    vscode.window.showWarningMessage("No devices connected");
    return undefined;
  }

  if (devices.length === 1) {
    return devices[0].serial;
  }

  const lastUsed = context?.globalState.get<string>("lastUsedDevice");

  const items = devices.map((d) => ({
    label: d.name,
    description: d.serial === lastUsed ? `${d.serial} (last used)` : d.serial,
    detail: `Android ${d.androidVersion} (API ${d.apiLevel})`,
    serial: d.serial,
  }));

  if (lastUsed) {
    items.sort((a, b) => {
      if (a.serial === lastUsed) return -1;
      if (b.serial === lastUsed) return 1;
      return 0;
    });
  }

  const selected = await vscode.window.showQuickPick(
    items,
    { placeHolder: "Select a device" }
  );

  if (selected && context) {
    await context.globalState.update("lastUsedDevice", selected.serial);
  }

  return selected?.serial;
}
