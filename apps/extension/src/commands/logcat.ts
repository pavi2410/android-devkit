import * as vscode from "vscode";
import type { AdbService } from "../services/adb";
import type { LogcatTreeProvider } from "../views/logcat";
import type { LogLevel } from "@android-devkit/logcat";
import { ANDROID_DEVKIT_COMMANDS } from "./ids";
import { resolveConfiguredOrDetectedAppPackage } from "../utils/android-app";

type LogcatDeviceSelection = {
  label: string;
  serial?: string;
};

async function resolveLogcatDevice(
  adbService: AdbService,
  currentSerial?: string
): Promise<LogcatDeviceSelection | undefined> {
  const readyDevices = (await adbService.getDevices()).filter((d) => d.state === "device");

  if (readyDevices.length === 0) {
    vscode.window.showWarningMessage("No connected devices or emulators available for Logcat.");
    return undefined;
  }

  if (currentSerial) {
    const currentDevice = readyDevices.find((device) => device.serial === currentSerial);
    if (currentDevice) {
      return {
        label: currentDevice.name,
        serial: currentDevice.serial,
      };
    }
  }

  if (readyDevices.length === 1) {
    return {
      label: readyDevices[0].name,
      serial: readyDevices[0].serial,
    };
  }

  const selection = await vscode.window.showQuickPick(
    [
      { label: "All Devices", description: "Use the current minimum log level across all connected devices", serial: undefined },
      ...readyDevices.map((device) => ({
        label: device.name,
        description: device.serial,
        detail: `Android ${device.androidVersion} · API ${device.apiLevel}`,
        serial: device.serial,
      })),
    ],
    {
      placeHolder: "Select a device or emulator for Logcat",
      title: "Start Logcat",
    }
  );

  if (!selection) {
    return undefined;
  }

  return {
    label: selection.label,
    serial: selection.serial,
  };
}

async function resolveDefaultPackagePid(
  adbService: AdbService,
  serial?: string,
  packageName?: string
): Promise<{ packageName?: string; pid?: number }> {
  if (!serial) {
    return {};
  }

  const resolvedPackageName = packageName ?? resolveConfiguredOrDetectedAppPackage();
  if (!resolvedPackageName) {
    return {};
  }

  const pid = await adbService.getPidForPackage(serial, resolvedPackageName).catch(() => null);
  return {
    packageName: resolvedPackageName,
    pid: pid ?? undefined,
  };
}

export function registerLogcatCommands(
  context: vscode.ExtensionContext,
  adbService: AdbService,
  logcatProvider: LogcatTreeProvider
): void {
  // Start logcat
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.startLogcat, async () => {
      if (logcatProvider.getSessionState() === "paused") {
        logcatProvider.resume();
        return;
      }

      const session = logcatProvider.getSession();
      const device = await resolveLogcatDevice(adbService, session.serial);
      if (!device) return;

      const defaultPackage = await resolveDefaultPackagePid(adbService, device.serial, session.packageName);
      logcatProvider.start({
        deviceLabel: device.label,
        minLevel: session.minLevel,
        packageName: defaultPackage.packageName,
        pid: defaultPackage.pid,
        serial: device.serial,
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.pauseLogcat, () => {
      logcatProvider.pause();
    })
  );

  // Stop logcat
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.stopLogcat, () => {
      logcatProvider.stop();
    })
  );

  // Clear logcat
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.clearLogcat, async () => {
      await logcatProvider.clear();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.showLogcatOutput, () => {
      logcatProvider.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.logcatStatusMenu, async () => {
      const state = logcatProvider.getSessionState();
      const items = [
        state === "paused"
          ? {
              label: "$(play) Resume Logcat",
              command: ANDROID_DEVKIT_COMMANDS.startLogcat,
            }
          : {
              label: "$(play) Start Logcat",
              command: ANDROID_DEVKIT_COMMANDS.startLogcat,
            },
        {
          label: "$(debug-pause) Pause Logcat",
          command: ANDROID_DEVKIT_COMMANDS.pauseLogcat,
        },
        {
          label: "$(debug-stop) Stop Logcat",
          command: ANDROID_DEVKIT_COMMANDS.stopLogcat,
        },
        {
          label: "$(clear-all) Clear Logcat",
          command: ANDROID_DEVKIT_COMMANDS.clearLogcat,
        },
        {
          label: "$(filter) Configure Filters",
          command: ANDROID_DEVKIT_COMMANDS.setLogcatFilter,
        },
        {
          label: "$(package) Choose Package Filter",
          command: ANDROID_DEVKIT_COMMANDS.setLogcatPackageFilter,
        },
        {
          label: "$(output) Show Output",
          command: ANDROID_DEVKIT_COMMANDS.showLogcatOutput,
        },
      ].filter((item) => {
        if (item.command === ANDROID_DEVKIT_COMMANDS.pauseLogcat) {
          return state === "running";
        }
        if (item.command === ANDROID_DEVKIT_COMMANDS.stopLogcat) {
          return state !== "stopped";
        }
        return true;
      });

      const selection = await vscode.window.showQuickPick(items, {
        title: "Logcat Controls",
        placeHolder: "Choose a Logcat action",
      });

      if (selection) {
        await vscode.commands.executeCommand(selection.command);
      }
    })
  );

  // Set log level filter
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.setLogcatFilter, async () => {
      const levels: LogLevel[] = ["V", "D", "I", "W", "E", "F"];
      const levelNames: Record<LogLevel, string> = {
        V: "Verbose",
        D: "Debug",
        I: "Info",
        W: "Warning",
        E: "Error",
        F: "Fatal",
        S: "Silent",
      };

      const currentLevel = logcatProvider.getSession().minLevel;

      // Ask for level filter
      const levelChoice = await vscode.window.showQuickPick(
        levels.map((l) => ({
          label: `${l} - ${levelNames[l]}`,
          description: l === currentLevel ? "Current" : undefined,
          detail: l === "V" || l === "D"
            ? "Higher verbosity can increase host/device load"
            : undefined,
          level: l,
        })),
        { placeHolder: "Select minimum log level", title: "Configure Logcat Filters" }
      );

      if (levelChoice) {
        logcatProvider.setMinLevel(levelChoice.level);
      }

      // Ask for text filter
      const textFilter = await vscode.window.showInputBox({
        prompt: "Enter text filter (tag or message content)",
        placeHolder: "e.g., MyApp, ActivityManager, error",
        value: "",
      });

      logcatProvider.setFilter(textFilter || undefined);
    })
  );

  // Filter by package name
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.setLogcatPackageFilter, async () => {
      const session = logcatProvider.getSession();
      const device = await resolveLogcatDevice(adbService, session.serial);
      if (!device?.serial) {
        if (device && !device.serial) {
          logcatProvider.setPackageFilter(undefined, undefined);
        }
        return;
      }
      const serial = device.serial;

      const currentAppPackage = resolveConfiguredOrDetectedAppPackage();

      // Let user type package name or pick from installed packages
      const inputMethod = await vscode.window.showQuickPick(
        [
          currentAppPackage
            ? { label: `Use current app package`, description: currentAppPackage, value: "current" }
            : undefined,
          { label: "Type package name", value: "type" },
          { label: "Pick from installed packages", value: "pick" },
          { label: "Clear package filter", value: "clear" },
        ].filter((item): item is { label: string; description?: string; value: string } => Boolean(item)),
        { placeHolder: "How should Logcat pick a package filter?", title: "Logcat Package Filter" }
      );

      if (!inputMethod) return;

      if (inputMethod.value === "clear") {
        logcatProvider.setPackageFilter(undefined, undefined);
        return;
      }

      let packageName: string | undefined;

      if (inputMethod.value === "current") {
        packageName = currentAppPackage;
      } else if (inputMethod.value === "type") {
        packageName = await vscode.window.showInputBox({
          prompt: "Enter package name",
          placeHolder: "com.example.myapp",
        });
      } else {
        const packages = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: "Loading packages..." },
          () => adbService.listPackages(serial)
        );

        const selected = await vscode.window.showQuickPick(
          packages.sort().map((p) => ({ label: p })),
          { placeHolder: "Select a package", matchOnDescription: true }
        );
        packageName = selected?.label;
      }

      if (!packageName) return;

      // Resolve PID for the package
      const pid = await adbService.getPidForPackage(serial, packageName);
      if (pid) {
        logcatProvider.setPackageFilter(packageName, pid);
      } else {
        logcatProvider.setPackageFilter(packageName);
        vscode.window.showWarningMessage(
          `Package ${packageName} is not running. Filtering by package name in tags only.`
        );
      }
    })
  );
}
