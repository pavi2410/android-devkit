import * as vscode from "vscode";
import { detectAndroidAppPackage } from "@android-devkit/android-project";

export function resolveDetectedAndroidAppPackage(): string | undefined {
  const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return projectRoot ? detectAndroidAppPackage(projectRoot) : undefined;
}

export async function promptForAndroidAppPackage(): Promise<string | undefined> {
  const resolved = resolveDetectedAndroidAppPackage();
  if (resolved) {
    return resolved;
  }

  return vscode.window.showInputBox({
    title: "App Package Name",
    prompt: "Enter the app package name (e.g. com.example.myapp)",
    placeHolder: "com.example.myapp",
  });
}
