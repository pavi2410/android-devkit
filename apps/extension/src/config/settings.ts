import * as vscode from "vscode";
import type { LogLevel } from "@android-devkit/logcat";
import { VS_CODE_COMMANDS } from "../commands/ids";

export const ANDROID_DEVKIT_SETTINGS = {
  sdkPath: "sdkPath",
  logcatDefaultLogLevel: "logcat.defaultLogLevel",
  logcatMaxLines: "logcat.maxLines",
} as const;

export type AndroidDevkitSettingKey =
  (typeof ANDROID_DEVKIT_SETTINGS)[keyof typeof ANDROID_DEVKIT_SETTINGS];

export function getAndroidDevkitConfiguration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("androidDevkit");
}

export function getAndroidDevkitSettingId(settingKey: AndroidDevkitSettingKey): string {
  return `androidDevkit.${settingKey}`;
}

export function getConfiguredSdkPath(): string {
  return getAndroidDevkitConfiguration().get<string>(ANDROID_DEVKIT_SETTINGS.sdkPath, "");
}

export function updateConfiguredSdkPath(
  fsPath: string,
  target: vscode.ConfigurationTarget | boolean = true
): Thenable<void> {
  return getAndroidDevkitConfiguration().update(ANDROID_DEVKIT_SETTINGS.sdkPath, fsPath, target);
}

export function getLogcatDefaultLogLevel(): LogLevel {
  return getAndroidDevkitConfiguration().get<LogLevel>(ANDROID_DEVKIT_SETTINGS.logcatDefaultLogLevel, "I");
}

export function getLogcatMaxLines(): number {
  return getAndroidDevkitConfiguration().get<number>(ANDROID_DEVKIT_SETTINGS.logcatMaxLines, 10000);
}

export function openAndroidDevkitSetting(settingKey: AndroidDevkitSettingKey): Thenable<unknown> {
  return vscode.commands.executeCommand(VS_CODE_COMMANDS.openSettings, getAndroidDevkitSettingId(settingKey));
}
