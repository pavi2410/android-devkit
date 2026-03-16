import * as vscode from "vscode";
import { detectAndroidAppPackage } from "@android-devkit/android-project";

export function resolveDetectedAndroidAppPackage(module?: string): string | undefined {
  const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return projectRoot ? detectAndroidAppPackage(projectRoot, module) : undefined;
}

export async function promptForAndroidAppPackage(module?: string): Promise<string | undefined> {
  const resolved = resolveDetectedAndroidAppPackage(module);
  if (resolved) {
    return resolved;
  }

  return vscode.window.showInputBox({
    title: "App Package Name",
    prompt: "Enter the app package name (e.g. com.example.myapp)",
    placeHolder: "com.example.myapp",
  });
}
