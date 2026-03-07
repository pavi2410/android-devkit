import * as vscode from "vscode";
import { spawn } from "node:child_process";
import {
  listTasks,
  getBuildVariants,
  findApk,
  getGradlewPath,
  type GradleTask,
  type BuildVariant,
} from "@android-devkit/gradle";

export type { GradleTask, BuildVariant };

export class GradleService {
  getProjectFolder(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  private resolveGradlewPath(): string | undefined {
    const projectFolder = this.getProjectFolder();
    return projectFolder ? getGradlewPath(projectFolder) : undefined;
  }

  async listTasks(): Promise<GradleTask[]> {
    const projectFolder = this.getProjectFolder();
    if (!projectFolder) throw new Error("No workspace folder open.");
    return listTasks(projectFolder);
  }

  async getBuildVariants(): Promise<BuildVariant[]> {
    const projectFolder = this.getProjectFolder();
    if (!projectFolder) throw new Error("No workspace folder open.");
    return getBuildVariants(projectFolder);
  }

  runTask(
    taskName: string,
    _outputChannel: vscode.OutputChannel,
    token?: vscode.CancellationToken
  ): Promise<void> {
    const gradlew = this.resolveGradlewPath();
    if (!gradlew) return Promise.reject(new Error("No gradlew found in workspace root."));

    const cwd = this.getProjectFolder();

    return new Promise((resolve, reject) => {
      const writeEmitter = new vscode.EventEmitter<string>();
      const closeEmitter = new vscode.EventEmitter<number>();
      let proc: ReturnType<typeof spawn> | undefined;

      token?.onCancellationRequested(() => proc?.kill());

      const pty: vscode.Pseudoterminal = {
        onDidWrite: writeEmitter.event,
        onDidClose: closeEmitter.event,
        open() {
          proc = spawn(gradlew, [taskName, "--console=rich"], { cwd });
          proc.stdout!.on("data", (d: Buffer) =>
            writeEmitter.fire(d.toString().replace(/\n([^\r]|$)/g, "\n\r$1"))
          );
          proc.stderr!.on("data", (d: Buffer) =>
            writeEmitter.fire(d.toString().replace(/\n([^\r]|$)/g, "\n\r$1"))
          );
          proc.on("close", (code: number | null) => {
            closeEmitter.fire(code ?? 0);
            if (code === 0 || code === null) resolve();
            else reject(new Error(`gradlew ${taskName} failed with code ${code}`));
          });
          proc.on("error", (err: Error) => {
            writeEmitter.fire(`Error: ${err.message}\n\r`);
            closeEmitter.fire(1);
            reject(err);
          });
        },
        close() {
          proc?.kill();
        },
      };

      const task = new vscode.Task(
        { type: "androidDevkit", task: taskName },
        vscode.TaskScope.Workspace,
        taskName,
        "Gradle",
        new vscode.CustomExecution(async () => pty)
      );
      task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Always,
        panel: vscode.TaskPanelKind.Dedicated,
        clear: true,
      };

      vscode.tasks.executeTask(task).then(undefined, reject);
    });
  }

  findApk(variant: BuildVariant): string | undefined {
    const projectFolder = this.getProjectFolder();
    if (!projectFolder) return undefined;
    return findApk(projectFolder, variant);
  }
}
