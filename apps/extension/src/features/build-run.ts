import * as vscode from "vscode";
import type { ServiceContainer } from "../services/container";
import { BuildRunProvider } from "../views/build-run";
import { registerRunCommands } from "../commands/run";
import { ANDROID_DEVKIT_COMMANDS } from "../commands/ids";

export function registerBuildRunFeature(
  context: vscode.ExtensionContext,
  services: ServiceContainer
): void {
  const buildRunProvider = new BuildRunProvider(services.gradle, services.adb, context);

  const targetDeviceStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 49);
  targetDeviceStatusBar.command = ANDROID_DEVKIT_COMMANDS.selectRunTarget;
  targetDeviceStatusBar.name = "Android DevKit Target Device";

  const buildVariantStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 48);
  buildVariantStatusBar.command = ANDROID_DEVKIT_COMMANDS.selectBuildVariant;
  buildVariantStatusBar.name = "Android DevKit Build Variant";

  const updateBuildVariantStatusBar = () => {
    const variant = buildRunProvider.getSelectedVariant()?.name ?? "Select Variant";
    buildVariantStatusBar.text = `$(symbol-enum) ${variant}`;
    buildVariantStatusBar.tooltip = "Select Android build variant";
    buildVariantStatusBar.show();
  };

  const updateTargetDeviceStatusBar = () => {
    const target = buildRunProvider.getSelectedDeviceLabel() ?? "Select Target";
    targetDeviceStatusBar.text = `$(device-mobile) ${target}`;
    targetDeviceStatusBar.tooltip = "Select target device or emulator";
    targetDeviceStatusBar.show();
  };

  context.subscriptions.push(
    buildRunProvider,
    targetDeviceStatusBar,
    buildVariantStatusBar,
    vscode.window.registerTreeDataProvider("androidDevkit.buildRun", buildRunProvider),
    buildRunProvider.onDidSelectionChange(() => {
      updateBuildVariantStatusBar();
      updateTargetDeviceStatusBar();
    }),
    services.adb.onDevicesChanged(async () => {
      try {
        const devices = await services.adb.getDevices();
        const readySerials = new Set(
          devices.filter((d) => d.state === "device").map((d) => d.serial)
        );
        const selectedTarget = buildRunProvider.getSelectedDeviceSerial();
        if (selectedTarget && !readySerials.has(selectedTarget)) {
          await buildRunProvider.setDevice("", "Select Target");
        }
      } catch {
        // ignore
      }
      updateTargetDeviceStatusBar();
    })
  );

  registerRunCommands(context, services.gradle, services.adb, buildRunProvider);

  // Initialize
  void buildRunProvider.ensureInitialized().finally(() => {
    updateBuildVariantStatusBar();
    updateTargetDeviceStatusBar();
  });
}
