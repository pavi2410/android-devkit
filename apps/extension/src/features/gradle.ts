import * as vscode from "vscode";
import type { ServiceContainer } from "../services/container";
import { GradleTasksProvider } from "../views/gradle-tasks";
import { registerGradleCommands } from "../commands/gradle";

export function registerGradleFeature(
  context: vscode.ExtensionContext,
  services: ServiceContainer
): void {
  const gradleTasksProvider = new GradleTasksProvider(services.gradle);

  const treeView = vscode.window.createTreeView("androidDevkit.gradleTasks", {
    treeDataProvider: gradleTasksProvider,
    manageCheckboxStateManually: false,
  });

  treeView.onDidChangeCheckboxState((e) => gradleTasksProvider.handleCheckboxChange(e));

  context.subscriptions.push(gradleTasksProvider, treeView);

  registerGradleCommands(context, services.gradle, gradleTasksProvider);
}
