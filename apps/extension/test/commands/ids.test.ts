import { describe, expect, it } from "vitest";
import { ANDROID_DEVKIT_COMMANDS, VS_CODE_COMMANDS, CONTEXT_KEYS } from "../../src/commands/ids";

describe("commands/ids", () => {
  it("ANDROID_DEVKIT_COMMANDS snapshot — catches accidental renames", () => {
    expect(ANDROID_DEVKIT_COMMANDS).toMatchInlineSnapshot(`
      {
        "addToTerminalPath": "androidDevkit.addToTerminalPath",
        "assembleBuild": "androidDevkit.assembleBuild",
        "browseFiles": "androidDevkit.browseFiles",
        "buildVariant": "androidDevkit.buildVariant",
        "cleanBuild": "androidDevkit.cleanBuild",
        "clearAppData": "androidDevkit.clearAppData",
        "clearLogcat": "androidDevkit.clearLogcat",
        "commandMenu": "androidDevkit.commandMenu",
        "connectDevice": "androidDevkit.connectDevice",
        "createAvd": "androidDevkit.createAvd",
        "deleteAvd": "androidDevkit.deleteAvd",
        "deleteRemoteFile": "androidDevkit.deleteRemoteFile",
        "enableTcpip": "androidDevkit.enableTcpip",
        "exportLogcat": "androidDevkit.exportLogcat",
        "focusAvdManager": "androidDevkit.avdManager.focus",
        "focusBuildRun": "androidDevkit.buildRun.focus",
        "focusDevices": "androidDevkit.devices.focus",
        "focusFileExplorer": "androidDevkit.fileExplorer.focus",
        "focusGradleTasks": "androidDevkit.gradleTasks.focus",
        "focusLogcat": "androidDevkit.logcat.focus",
        "installApk": "androidDevkit.installApk",
        "installSdkPackage": "androidDevkit.installSdkPackage",
        "launchAvd": "androidDevkit.launchAvd",
        "logcatStatusMenu": "androidDevkit.logcatStatusMenu",
        "managePermissions": "androidDevkit.managePermissions",
        "mirrorScreen": "androidDevkit.mirrorScreen",
        "openDeviceFile": "androidDevkit.openDeviceFile",
        "openSdkManager": "androidDevkit.openSdkManager",
        "openShell": "androidDevkit.openShell",
        "pairDevice": "androidDevkit.pairDevice",
        "pauseLogcat": "androidDevkit.pauseLogcat",
        "pullFile": "androidDevkit.pullFile",
        "pushFile": "androidDevkit.pushFile",
        "rebootDevice": "androidDevkit.rebootDevice",
        "recordScreen": "androidDevkit.recordScreen",
        "refreshAvds": "androidDevkit.refreshAvds",
        "refreshDevices": "androidDevkit.refreshDevices",
        "refreshFileExplorer": "androidDevkit.refreshFileExplorer",
        "refreshGradleTasks": "androidDevkit.refreshGradleTasks",
        "refreshProjectLayout": "androidDevkit.refreshProjectLayout",
        "refreshSdkPackages": "androidDevkit.refreshSdkPackages",
        "runGradleTask": "androidDevkit.runGradleTask",
        "runOnDevice": "androidDevkit.runOnDevice",
        "selectBuildVariant": "androidDevkit.selectBuildVariant",
        "selectRunTarget": "androidDevkit.selectRunTarget",
        "setLogcatFilter": "androidDevkit.setLogcatFilter",
        "setLogcatPackageFilter": "androidDevkit.setLogcatPackageFilter",
        "showLogcatOutput": "androidDevkit.showLogcatOutput",
        "showSdkInfo": "androidDevkit.showSdkInfo",
        "startLogcat": "androidDevkit.startLogcat",
        "stopApp": "androidDevkit.stopApp",
        "stopLogcat": "androidDevkit.stopLogcat",
        "syncGradle": "androidDevkit.syncGradle",
        "takeScreenshot": "androidDevkit.takeScreenshot",
        "testDeepLink": "androidDevkit.testDeepLink",
        "uninstallApp": "androidDevkit.uninstallApp",
        "uninstallSdkPackage": "androidDevkit.uninstallSdkPackage",
        "updateAllSdkPackages": "androidDevkit.updateAllSdkPackages",
        "wipeAvdData": "androidDevkit.wipeAvdData",
      }
    `);
  });

  it("VS_CODE_COMMANDS snapshot", () => {
    expect(VS_CODE_COMMANDS).toMatchInlineSnapshot(`
      {
        "open": "vscode.open",
        "openSettings": "workbench.action.openSettings",
        "openWalkthrough": "workbench.action.openWalkthrough",
        "revealFileInOs": "revealFileInOS",
        "setContext": "setContext",
      }
    `);
  });

  it("CONTEXT_KEYS snapshot", () => {
    expect(CONTEXT_KEYS).toMatchInlineSnapshot(`
      {
        "fileExplorerHasDevice": "androidDevkit.fileExplorerHasDevice",
        "hasAvds": "androidDevkit.hasAvds",
        "hasDevices": "androidDevkit.hasDevices",
        "logcatPaused": "androidDevkit.logcatPaused",
        "logcatRunning": "androidDevkit.logcatRunning",
        "sdkConfigured": "androidDevkit.sdkConfigured",
      }
    `);
  });

  it("all command IDs use the androidDevkit prefix", () => {
    for (const [key, value] of Object.entries(ANDROID_DEVKIT_COMMANDS)) {
      if (key.startsWith("focus")) {
        expect(value).toMatch(/^androidDevkit\./);
      } else {
        expect(value).toBe(`androidDevkit.${key}`);
      }
    }
  });
});
