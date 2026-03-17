import * as vscode from "vscode";
import type { ServiceContainer } from "../services/container";
import { LogcatTreeProvider } from "../views/logcat";
import { registerLogcatCommands } from "../commands/logcat";
import { ANDROID_DEVKIT_COMMANDS } from "../commands/ids";

export function registerLogcatFeature(
  context: vscode.ExtensionContext,
  services: ServiceContainer
): void {
  const logcatProvider = new LogcatTreeProvider(services.logcat, context);

  const logcatStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 47);
  logcatStatusBar.command = ANDROID_DEVKIT_COMMANDS.logcatStatusMenu;
  logcatStatusBar.name = "Android DevKit Logcat";

  const updateStatusBar = () => {
    const session = logcatProvider.getSession();
    const state = logcatProvider.getSessionState();
    const stateLabel = state.charAt(0).toUpperCase() + state.slice(1);
    const detail = session.deviceLabel ?? session.serial ?? "Choose device";
    logcatStatusBar.text = `$(output) Logcat: ${stateLabel}`;
    logcatStatusBar.tooltip = session.packageName
      ? `Logcat ${stateLabel} — ${detail} — ${session.packageName}`
      : `Logcat ${stateLabel} — ${detail}`;
  };

  context.subscriptions.push(
    logcatProvider,
    logcatStatusBar,
    vscode.window.registerTreeDataProvider("androidDevkit.logcat", logcatProvider),
    logcatProvider.onDidSessionChange(() => {
      updateStatusBar();
    }),
    services.adb.onDevicesChanged(async () => {
      try {
        const devices = await services.adb.getDevices();
        const ready = devices.filter((d) => d.state === "device");
        logcatProvider.setHasAvailableDevices(ready.length > 0);
        updateStatusBar();
        if (ready.length > 0) {
          logcatStatusBar.show();
        } else {
          logcatStatusBar.hide();
        }
      } catch {
        logcatProvider.setHasAvailableDevices(false);
        logcatStatusBar.hide();
      }
    })
  );

  registerLogcatCommands(context, services.adb, logcatProvider);

  // Initial state
  updateStatusBar();
}
