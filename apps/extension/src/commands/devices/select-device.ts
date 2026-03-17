import * as vscode from "vscode";
import type { AdbService } from "../../services/adb";

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
