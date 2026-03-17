import * as vscode from "vscode";
import type { ServiceContainer } from "../services/container";
import { GradleTasksProvider } from "../views/gradle-tasks";
import { registerGradleCommands } from "../commands/gradle";

export function registerGradleFeature(
  context: vscode.ExtensionContext,
  services: ServiceContainer
): void {
  const gradleTasksProvider = new GradleTasksProvider(services.gradle);

  context.subscriptions.push(
    gradleTasksProvider,
    vscode.window.registerTreeDataProvider("androidDevkit.gradleTasks", gradleTasksProvider)
  );

  registerGradleCommands(context, services.gradle, gradleTasksProvider);
}
