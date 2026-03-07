import * as vscode from "vscode";
import type { GradleService } from "../services/gradle";
import type { GradleTasksProvider, TaskItem } from "../views/gradle-tasks";
import { ANDROID_DEVKIT_COMMANDS } from "./ids";

export function registerGradleCommands(
  context: vscode.ExtensionContext,
  gradleService: GradleService,
  gradleTasksProvider: GradleTasksProvider
): void {
  const outputChannel = vscode.window.createOutputChannel("ADK: Gradle", "ansi");
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.refreshGradleTasks, () => {
      gradleTasksProvider.refresh();
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.syncGradle, async () => {
      outputChannel.clear();
      outputChannel.show(true);
      outputChannel.appendLine("Syncing Gradle project…");
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Syncing Gradle…", cancellable: true },
        async (_progress, token) => {
          try {
            await gradleService.runTask("help", outputChannel, token);
            gradleTasksProvider.refresh();
            vscode.window.showInformationMessage("Gradle sync complete.");
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            vscode.window.showErrorMessage(`Gradle sync failed: ${msg}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.runGradleTask, async (item?: TaskItem) => {
      let taskName: string | undefined;

      if (item?.task) {
        taskName = item.task.project !== ":" ? `${item.task.project}:${item.task.name}` : item.task.name;
      } else {
        taskName = await vscode.window.showInputBox({
          title: "Run Gradle Task",
          prompt: "Enter task name (e.g. assembleDebug, test, clean)",
          placeHolder: "assembleDebug",
        });
      }

      if (!taskName) return;

      outputChannel.clear();
      outputChannel.show(true);
      outputChannel.appendLine(`Running task: ${taskName}`);

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Gradle: ${taskName}`, cancellable: true },
        async (_progress, token) => {
          try {
            await gradleService.runTask(taskName!, outputChannel, token);
            vscode.window.showInformationMessage(`✓ ${taskName} succeeded.`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            vscode.window.showErrorMessage(`Task ${taskName} failed: ${msg}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.cleanBuild, async () => {
      outputChannel.clear();
      outputChannel.show(true);
      outputChannel.appendLine("Running clean…");
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Gradle: clean", cancellable: true },
        async (_progress, token) => {
          try {
            await gradleService.runTask("clean", outputChannel, token);
            vscode.window.showInformationMessage("✓ clean succeeded.");
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            vscode.window.showErrorMessage(`clean failed: ${msg}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.assembleBuild, async () => {
      outputChannel.clear();
      outputChannel.show(true);
      outputChannel.appendLine("Running assemble…");
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Gradle: assemble", cancellable: true },
        async (_progress, token) => {
          try {
            await gradleService.runTask("assemble", outputChannel, token);
            vscode.window.showInformationMessage("✓ assemble succeeded.");
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            vscode.window.showErrorMessage(`assemble failed: ${msg}`);
          }
        }
      );
    })
  );
}
