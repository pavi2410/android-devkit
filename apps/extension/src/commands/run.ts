import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import type { GradleService } from "../services/gradle";
import type { AdbService } from "../services/adb";
import type { BuildRunProvider } from "../views/build-run";
import { ANDROID_DEVKIT_COMMANDS } from "./ids";

function detectAppPackage(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;

  const root = folders[0].uri.fsPath;
  const manifestPaths = [
    path.join(root, "app", "src", "main", "AndroidManifest.xml"),
    path.join(root, "src", "main", "AndroidManifest.xml"),
    path.join(root, "AndroidManifest.xml"),
  ];

  for (const manifestPath of manifestPaths) {
    if (!fs.existsSync(manifestPath)) continue;
    const content = fs.readFileSync(manifestPath, "utf-8");
    const match = content.match(/package\s*=\s*["']([^"']+)["']/);
    if (match) return match[1];
  }

  return undefined;
}

async function resolvePackageName(): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration("androidDevkit");
  const configured = config.get<string>("appPackage");
  if (configured) return configured;

  const detected = detectAppPackage();
  if (detected) return detected;

  return vscode.window.showInputBox({
    title: "App Package Name",
    prompt: "Enter the app package name (e.g. com.example.myapp)",
    placeHolder: "com.example.myapp",
  });
}

export function registerRunCommands(
  context: vscode.ExtensionContext,
  gradleService: GradleService,
  adbService: AdbService,
  buildRunProvider: BuildRunProvider
): void {
  const outputChannel = vscode.window.createOutputChannel("ADK: Build & Run", "ansi");
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.selectBuildVariant, async () => {
      let variants = buildRunProvider.getVariants();
      if (variants.length === 0) {
        try {
          variants = await gradleService.getBuildVariants();
        } catch {
          vscode.window.showWarningMessage("No build variants found. Make sure a Gradle project with gradlew is open.");
          return;
        }
      }
      if (variants.length === 0) {
        vscode.window.showWarningMessage("No build variants found. Make sure a Gradle project with gradlew is open.");
        return;
      }
      const items = variants.map((v) => ({
        label: v.name,
        description: v.assembleTask,
        variant: v,
      }));
      const selected = await vscode.window.showQuickPick(items, {
        title: "Select Build Variant",
        placeHolder: "Choose a build variant",
      });
      if (selected) {
        await buildRunProvider.setVariant(selected.variant);
      }
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.selectRunTarget, async () => {
      let devices: { serial: string; label: string }[] = [];
      try {
        const deviceInfos = await adbService.getDevices();
        devices = deviceInfos
          .filter((d) => d.state === "device")
          .map((d) => ({ serial: d.serial, label: `${d.name} (${d.serial})` }));
      } catch {
        vscode.window.showErrorMessage("Failed to list devices. Is ADB running?");
        return;
      }

      if (devices.length === 0) {
        vscode.window.showWarningMessage("No connected devices or emulators found.");
        return;
      }

      const items = devices.map((d) => ({ label: d.label, description: d.serial, device: d }));
      const selected = await vscode.window.showQuickPick(items, {
        title: "Select Run Target",
        placeHolder: "Choose a device or emulator",
      });
      if (selected) {
        await buildRunProvider.setDevice(selected.device.serial, selected.device.label);
      }
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.buildVariant, async () => {
      const variant = buildRunProvider.getSelectedVariant();
      if (!variant) {
        vscode.window.showWarningMessage("No build variant selected. Click 'Build Variant' to choose one.");
        return;
      }

      outputChannel.clear();
      outputChannel.show(true);
      outputChannel.appendLine(`Building variant: ${variant.name} (${variant.assembleTask})`);

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Building ${variant.name}…`, cancellable: true },
        async (_progress, token) => {
          try {
            await gradleService.runTask(variant.assembleTask, outputChannel, token);
            vscode.window.showInformationMessage(`✓ ${variant.name} build succeeded.`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            vscode.window.showErrorMessage(`Build failed: ${msg}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.runOnDevice, async () => {
      const variant = buildRunProvider.getSelectedVariant();
      const serial = buildRunProvider.getSelectedDeviceSerial();

      if (!variant) {
        vscode.window.showWarningMessage("No build variant selected.");
        return;
      }
      if (!serial) {
        vscode.window.showWarningMessage("No target device selected.");
        return;
      }

      const packageName = await resolvePackageName();
      if (!packageName) return;

      outputChannel.clear();
      outputChannel.show(true);

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Running ${variant.name} on device…`, cancellable: true },
        async (_progress, token) => {
          try {
            outputChannel.appendLine(`[1/3] Building ${variant.assembleTask}…`);
            await gradleService.runTask(variant.assembleTask, outputChannel, token);

            const apkPath = gradleService.findApk(variant);
            if (!apkPath) {
              throw new Error(`APK not found for variant "${variant.name}". Build may have failed or APK is in a non-standard location.`);
            }

            outputChannel.appendLine(`[2/3] Installing ${apkPath}…`);
            await adbService.installApk(serial, apkPath);

            outputChannel.appendLine(`[3/3] Launching ${packageName}…`);
            await adbService.launchApp(serial, packageName);

            outputChannel.appendLine(`\n✓ App launched successfully.`);
            vscode.window.showInformationMessage(`✓ ${packageName} running on device.`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            outputChannel.appendLine(`\n✗ Error: ${msg}`);
            vscode.window.showErrorMessage(`Run failed: ${msg}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.stopApp, async () => {
      const serial = buildRunProvider.getSelectedDeviceSerial();
      if (!serial) {
        vscode.window.showWarningMessage("No target device selected.");
        return;
      }

      const packageName = await resolvePackageName();
      if (!packageName) return;

      try {
        await adbService.forceStopApp(serial, packageName);
        vscode.window.showInformationMessage(`✓ ${packageName} stopped.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to stop app: ${msg}`);
      }
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.installApk, async () => {
      const serial = buildRunProvider.getSelectedDeviceSerial();
      if (!serial) {
        vscode.window.showWarningMessage("No target device selected. Click 'Target Device' to choose one.");
        return;
      }

      const uris = await vscode.window.showOpenDialog({
        title: "Select APK to install",
        filters: { "Android Package": ["apk"] },
        canSelectMany: false,
      });
      if (!uris || uris.length === 0) return;

      const apkPath = uris[0].fsPath;
      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `Installing ${path.basename(apkPath)}…`, cancellable: false },
          () => adbService.installApk(serial, apkPath)
        );
        vscode.window.showInformationMessage(`✓ ${path.basename(apkPath)} installed.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        vscode.window.showErrorMessage(`Install failed: ${msg}`);
      }
    })
  );
}
