import * as vscode from "vscode";
import { detectAndroidAppPackage } from "@android-devkit/android-project";

export function resolveConfiguredOrDetectedAppPackage(): string | undefined {
  const configured = vscode.workspace.getConfiguration("androidDevkit").get<string>("appPackage");
  if (configured) {
    return configured;
  }

  const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return projectRoot ? detectAndroidAppPackage(projectRoot) : undefined;
}

export async function promptForAndroidAppPackage(): Promise<string | undefined> {
  const resolved = resolveConfiguredOrDetectedAppPackage();
  if (resolved) {
    return resolved;
  }

  return vscode.window.showInputBox({
    title: "App Package Name",
    prompt: "Enter the app package name (e.g. com.example.myapp)",
    placeHolder: "com.example.myapp",
  });
}
