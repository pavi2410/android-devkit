import * as vscode from "vscode";
import type { SdkService } from "../services/sdk";
import type { AdbService } from "../services/adb";
import type { ScrcpyService } from "../services/scrcpy";
import type { AvdManagerProvider } from "../views/avd-manager";
import { AvdItem } from "../views/avd-manager";
import { ScrcpyPanel } from "../webviews/scrcpy";
import { getEmulatorLaunchMode } from "../config/settings";
import { ANDROID_DEVKIT_COMMANDS } from "./ids";

export function registerAvdCommands(
  context: vscode.ExtensionContext,
  sdkService: SdkService,
  avdManagerProvider: AvdManagerProvider,
  adbService: AdbService,
  scrcpyService: ScrcpyService
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.refreshAvds, () => {
      avdManagerProvider.refresh();
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.createAvd, async () => {
      const sdkPath = sdkService.getSdkPath();
      if (!sdkPath) {
        vscode.window.showErrorMessage("Android SDK not found. Configure androidDevkit.sdkPath.");
        return;
      }

      // Step 1: List available system images
      let packages;
      try {
        packages = await sdkService.listSdkPackages();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to load SDK packages: ${msg}`);
        return;
      }

      const systemImages = packages.filter(
        (p) => p.category === "system-images" && p.installed
      );

      if (systemImages.length === 0) {
        const action = await vscode.window.showWarningMessage(
          "No system images installed. Install one via the SDK Manager first.",
          "Open SDK Manager"
        );
        if (action === "Open SDK Manager") {
          vscode.commands.executeCommand(ANDROID_DEVKIT_COMMANDS.openSdkManager);
        }
        return;
      }

      const imageChoice = await vscode.window.showQuickPick(
        systemImages.map((p) => ({ label: p.displayName, description: p.id, id: p.id })),
        { title: "Create AVD — Step 1/3: Select System Image", placeHolder: "Choose a system image" }
      );
      if (!imageChoice) return;

      // Step 2: Device profile
      let profiles;
      try {
        profiles = await sdkService.listDeviceProfiles();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to load device profiles: ${msg}`);
        return;
      }

      const profileChoice = await vscode.window.showQuickPick(
        profiles.map((p) => ({ label: p.name, description: `${p.oem} · ${p.id}`, id: p.id })),
        { title: "Create AVD — Step 2/3: Select Device Profile", placeHolder: "Choose a hardware profile" }
      );
      if (!profileChoice) return;

      // Step 3: Name
      const suggestedName = imageChoice.label
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_.-]/g, "");

      const name = await vscode.window.showInputBox({
        title: "Create AVD — Step 3/3: Name",
        prompt: "Enter a name for the new AVD",
        value: suggestedName,
        validateInput: (v) => v.trim() ? undefined : "Name cannot be empty",
      });
      if (!name) return;

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `Creating AVD "${name}"…`, cancellable: false },
          () => sdkService.createAvd({ name, systemImage: imageChoice.id, device: profileChoice.id })
        );
        vscode.window.showInformationMessage(`✓ AVD "${name}" created.`);
        avdManagerProvider.refresh();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to create AVD: ${msg}`);
      }
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.launchAvd, async (item?: AvdItem) => {
      let name: string | undefined;

      if (item instanceof AvdItem) {
        name = item.avd.name;
      } else {
        const avds = await sdkService.listAvds().catch(() => []);
        const choice = await vscode.window.showQuickPick(
          avds.map((a) => ({ label: a.name.replace(/_/g, " "), description: a.target, name: a.name })),
          { title: "Launch AVD", placeHolder: "Select an AVD to launch" }
        );
        name = choice?.name;
      }

      if (!name) return;

      const launchMode = getEmulatorLaunchMode();

      try {
        if (launchMode === "external") {
          sdkService.launchAvd(name);
          vscode.window.showInformationMessage(`Launching emulator: ${name}`);
        } else {
          sdkService.launchAvd(name, { noWindow: true });
          await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: "Waiting for emulator...", cancellable: true },
            async (_progress, token) => {
              const pollInterval = 1000;
              const timeout = 60000;
              const start = Date.now();

              while (Date.now() - start < timeout) {
                if (token.isCancellationRequested) return;

                const devices = await adbService.getDevices();
                for (const device of devices) {
                  if (device.state === "device" && device.serial.startsWith("emulator-")) {
                    const avdName = await adbService.getEmulatorAvdName(device.serial);
                    if (avdName === name) {
                      const displayName = name.replace(/_/g, " ");
                      ScrcpyPanel.show(context, scrcpyService, device.serial, displayName);
                      return;
                    }
                  }
                }

                await new Promise((resolve) => setTimeout(resolve, pollInterval));
              }

              vscode.window.showWarningMessage(`Timed out waiting for emulator "${name}" to start.`);
            }
          );
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to launch AVD: ${msg}`);
      }
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.deleteAvd, async (item?: AvdItem) => {
      if (!(item instanceof AvdItem)) return;
      const { name } = item.avd;

      const confirm = await vscode.window.showWarningMessage(
        `Delete AVD "${name}"? This cannot be undone.`,
        { modal: true },
        "Delete"
      );
      if (confirm !== "Delete") return;

      try {
        await sdkService.deleteAvd(name);
        vscode.window.showInformationMessage(`✓ AVD "${name}" deleted.`);
        avdManagerProvider.refresh();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to delete AVD: ${msg}`);
      }
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.wipeAvdData, async (item?: AvdItem) => {
      if (!(item instanceof AvdItem)) return;
      const { name } = item.avd;

      const confirm = await vscode.window.showWarningMessage(
        `Wipe all user data for "${name}"?`,
        { modal: true },
        "Wipe"
      );
      if (confirm !== "Wipe") return;

      try {
        sdkService.wipeAvdData(name);
        vscode.window.showInformationMessage(`Wiping data for "${name}"…`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to wipe AVD data: ${msg}`);
      }
    })
  );
}
