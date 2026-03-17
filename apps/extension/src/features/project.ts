import * as vscode from "vscode";
import type { ServiceContainer } from "../services/container";
import type { FileExplorerProvider } from "../views/file-explorer";
import { ProjectLayoutProvider } from "../views/project-layout";
import { registerCoreCommands } from "../commands/core";

export function registerProjectFeature(
  context: vscode.ExtensionContext,
  services: ServiceContainer,
  fileExplorerProvider: FileExplorerProvider
): void {
  const projectLayoutProvider = new ProjectLayoutProvider();

  context.subscriptions.push(
    projectLayoutProvider,
    vscode.window.registerTreeDataProvider("androidDevkit.projectLayout", projectLayoutProvider)
  );

  registerCoreCommands(context, {
    adbService: services.adb,
    fileExplorerProvider,
    projectLayoutProvider,
    sdkService: services.sdk,
  });
}
