import * as vscode from "vscode";
import type { AdbService } from "../services/adb";
import type { LogcatTreeProvider } from "../views/logcat";
import type { LogLevel } from "@android-devkit/logcat";
import { ANDROID_DEVKIT_COMMANDS } from "./ids";

export function registerLogcatCommands(
  context: vscode.ExtensionContext,
  adbService: AdbService,
  logcatProvider: LogcatTreeProvider
): void {
  // Start logcat
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.startLogcat, async () => {
      const devices = await adbService.getDevices();

      let serial: string | undefined;

      if (devices.length > 1) {
        const selected = await vscode.window.showQuickPick(
          [
            { label: "All Devices", serial: undefined },
            ...devices.map((d) => ({
              label: d.name,
              description: d.serial,
              serial: d.serial,
            })),
          ],
          { placeHolder: "Select a device for logcat" }
        );

        if (!selected) return;
        serial = selected.serial;
      } else if (devices.length === 1) {
        serial = devices[0].serial;
      }

      logcatProvider.start(serial);
      vscode.window.showInformationMessage("Logcat started");
    })
  );

  // Stop logcat
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.stopLogcat, () => {
      logcatProvider.stop();
      vscode.window.showInformationMessage("Logcat stopped");
    })
  );

  // Clear logcat
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.clearLogcat, async () => {
      await logcatProvider.clear();
      vscode.window.showInformationMessage("Logcat cleared");
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

      // Ask for level filter
      const levelChoice = await vscode.window.showQuickPick(
        levels.map((l) => ({
          label: `${l} - ${levelNames[l]}`,
          level: l,
        })),
        { placeHolder: "Select minimum log level" }
      );

      if (levelChoice) {
        logcatProvider.setMinLevel(levelChoice.level);
      }

      // Ask for text filter
      const textFilter = await vscode.window.showInputBox({
        prompt: "Enter text filter (tag or message content)",
        placeHolder: "e.g., MyApp, ActivityManager, error",
      });

      logcatProvider.setFilter(textFilter || undefined);

      const filterDesc = [];
      if (levelChoice) filterDesc.push(`Level: ${levelChoice.level}+`);
      if (textFilter) filterDesc.push(`Text: "${textFilter}"`);

      if (filterDesc.length > 0) {
        vscode.window.showInformationMessage(`Filter set: ${filterDesc.join(", ")}`);
      } else {
        vscode.window.showInformationMessage("Filters cleared");
      }
    })
  );

  // Filter by package name
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.setLogcatPackageFilter, async () => {
      const devices = await adbService.getDevices();
      const readyDevices = devices.filter((d) => d.state === "device");

      if (readyDevices.length === 0) {
        vscode.window.showWarningMessage("No devices connected to list packages");
        return;
      }

      const serial = readyDevices.length === 1
        ? readyDevices[0].serial
        : (await vscode.window.showQuickPick(
            readyDevices.map((d) => ({ label: d.name, description: d.serial, serial: d.serial })),
            { placeHolder: "Select device to list packages from" }
          ))?.serial;

      if (!serial) return;

      // Let user type package name or pick from installed packages
      const inputMethod = await vscode.window.showQuickPick(
        [
          { label: "Type package name", value: "type" },
          { label: "Pick from installed packages", value: "pick" },
          { label: "Clear package filter", value: "clear" },
        ],
        { placeHolder: "How to set package filter?" }
      );

      if (!inputMethod) return;

      if (inputMethod.value === "clear") {
        logcatProvider.setPackageFilter(undefined);
        vscode.window.showInformationMessage("Package filter cleared");
        return;
      }

      let packageName: string | undefined;

      if (inputMethod.value === "type") {
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
        vscode.window.showInformationMessage(`Filtering logcat by ${packageName} (PID: ${pid})`);
      } else {
        logcatProvider.setPackageFilter(packageName);
        vscode.window.showWarningMessage(
          `Package ${packageName} is not running. Filtering by package name in tags only.`
        );
      }
    })
  );
}
