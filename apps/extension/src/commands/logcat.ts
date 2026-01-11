import * as vscode from "vscode";
import type { AdbService } from "../services/adb";
import type { LogcatTreeProvider } from "../views/logcat";
import type { LogLevel } from "@aspect/adb";

export function registerLogcatCommands(
  context: vscode.ExtensionContext,
  adbService: AdbService,
  logcatProvider: LogcatTreeProvider
): void {
  // Start logcat
  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.startLogcat", async () => {
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
    vscode.commands.registerCommand("androidDevkit.stopLogcat", () => {
      logcatProvider.stop();
      vscode.window.showInformationMessage("Logcat stopped");
    })
  );

  // Clear logcat
  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.clearLogcat", async () => {
      await logcatProvider.clear();
      vscode.window.showInformationMessage("Logcat cleared");
    })
  );

  // Set filter
  context.subscriptions.push(
    vscode.commands.registerCommand("androidDevkit.setLogcatFilter", async () => {
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
}
