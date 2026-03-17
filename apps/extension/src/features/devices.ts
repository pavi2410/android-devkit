import * as vscode from "vscode";
import type { ServiceContainer } from "../services/container";
import { DevicesTreeProvider } from "../views/devices";
import { FileExplorerProvider } from "../views/file-explorer";
import { registerDeviceCommands } from "../commands/devices";
import { CONTEXT_KEYS } from "../commands/ids";
import { setAndroidDevkitContext } from "../config/context";

export function registerDeviceFeature(
  context: vscode.ExtensionContext,
  services: ServiceContainer
): FileExplorerProvider {
  const devicesProvider = new DevicesTreeProvider(services.adb);
  const fileExplorerProvider = new FileExplorerProvider(services.adb);

  context.subscriptions.push(
    devicesProvider,
    fileExplorerProvider,
    vscode.window.registerTreeDataProvider("androidDevkit.devices", devicesProvider),
    vscode.window.registerTreeDataProvider("androidDevkit.fileExplorer", fileExplorerProvider),
    services.adb.onDevicesChanged(() => {
      void refreshDeviceState(services, fileExplorerProvider);
    })
  );

  registerDeviceCommands(context, services.adb, services.scrcpy, devicesProvider, fileExplorerProvider);

  devicesProvider.refresh();

  return fileExplorerProvider;
}

async function refreshDeviceState(
  services: ServiceContainer,
  fileExplorerProvider: FileExplorerProvider
): Promise<void> {
  try {
    const devices = await services.adb.getDevices();
    await setAndroidDevkitContext(CONTEXT_KEYS.hasDevices, devices.length > 0);

    const readySerials = new Set(
      devices.filter((d) => d.state === "device").map((d) => d.serial)
    );

    const fileExplorerDevice = fileExplorerProvider.getCurrentDevice();
    if (fileExplorerDevice && !readySerials.has(fileExplorerDevice)) {
      fileExplorerProvider.clearDevice();
    }
  } catch {
    await setAndroidDevkitContext(CONTEXT_KEYS.hasDevices, false);
  }
}
