import * as vscode from "vscode";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import type { ExtensionApi as GradleApi, Output } from "vscode-gradle";

export interface GradleTask {
  name: string;
  group: string;
  description: string;
  project: string;
}

export interface BuildVariant {
  name: string;
  assembleTask: string;
}

export class GradleService {
  private get gradleApi(): GradleApi | undefined {
    const ext = vscode.extensions.getExtension("vscjava.vscode-gradle");
    return ext?.isActive ? (ext.exports as GradleApi) : undefined;
  }

  private getGradlewPath(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return undefined;
    const root = folders[0].uri.fsPath;
    const gradlew = process.platform === "win32"
      ? path.join(root, "gradlew.bat")
      : path.join(root, "gradlew");
    return fs.existsSync(gradlew) ? gradlew : undefined;
  }

  getProjectFolder(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  async listTasks(): Promise<GradleTask[]> {
    const gradlew = this.getGradlewPath();
    if (!gradlew) throw new Error("No gradlew found in workspace root.");

    return new Promise((resolve, reject) => {
      const proc = spawn(gradlew, ["tasks", "--all", "--console=plain"], {
        cwd: this.getProjectFolder(),
      });

      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
      proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`gradlew tasks failed (code ${code}): ${stderr}`));
          return;
        }
        resolve(parseGradleTasks(stdout));
      });
      proc.on("error", reject);
    });
  }

  async getBuildVariants(): Promise<BuildVariant[]> {
    const tasks = await this.listTasks();
    const assembleTasks = tasks.filter(
      (t) => t.name.startsWith("assemble") && t.name !== "assemble"
    );
    return assembleTasks.map((t) => ({
      name: t.name.replace(/^assemble/, ""),
      assembleTask: t.name,
    }));
  }

  async runTask(
    taskName: string,
    outputChannel: vscode.OutputChannel,
    token?: vscode.CancellationToken
  ): Promise<void> {
    const projectFolder = this.getProjectFolder();
    if (!projectFolder) throw new Error("No workspace folder open.");

    const api = this.gradleApi;
    if (api) {
      return this.runTaskViaApi(api, projectFolder, taskName, outputChannel, token);
    }
    return this.runTaskViaGradlew(taskName, outputChannel, token);
  }

  private runTaskViaApi(
    api: GradleApi,
    projectFolder: string,
    taskName: string,
    outputChannel: vscode.OutputChannel,
    token?: vscode.CancellationToken
  ): Promise<void> {
    const decoder = new TextDecoder("utf-8");
    const runOpts = {
      projectFolder,
      taskName,
      showOutputColors: false,
      onOutput: (output: Output) => {
        const message = decoder.decode(output.getOutputBytes_asU8());
        outputChannel.append(message);
      },
    };

    const runPromise = api.runTask(runOpts);

    if (token) {
      token.onCancellationRequested(() => {
        api.cancelRunTask({ projectFolder, taskName });
      });
    }

    return runPromise;
  }

  private runTaskViaGradlew(
    taskName: string,
    outputChannel: vscode.OutputChannel,
    token?: vscode.CancellationToken
  ): Promise<void> {
    const gradlew = this.getGradlewPath();
    if (!gradlew) return Promise.reject(new Error("No gradlew found in workspace root."));

    return new Promise((resolve, reject) => {
      const proc = spawn(gradlew, [taskName, "--console=plain"], {
        cwd: this.getProjectFolder(),
      });

      token?.onCancellationRequested(() => proc.kill());

      proc.stdout.on("data", (d: Buffer) => outputChannel.append(d.toString()));
      proc.stderr.on("data", (d: Buffer) => outputChannel.append(d.toString()));
      proc.on("close", (code) => {
        if (code === 0 || code === null) resolve();
        else reject(new Error(`gradlew ${taskName} failed with code ${code}`));
      });
      proc.on("error", reject);
    });
  }

  findApk(variant: BuildVariant): string | undefined {
    const projectFolder = this.getProjectFolder();
    if (!projectFolder) return undefined;
    const variantLower = variant.name.toLowerCase();
    const candidates = [
      path.join(projectFolder, "app", "build", "outputs", "apk", variantLower, `app-${variantLower}.apk`),
      path.join(projectFolder, "app", "build", "outputs", "apk", variantLower, `app-${variantLower}-unsigned.apk`),
    ];
    return candidates.find((p) => fs.existsSync(p));
  }
}

function parseGradleTasks(output: string): GradleTask[] {
  const tasks: GradleTask[] = [];
  let currentGroup = "other";

  for (const line of output.split("\n")) {
    const trimmed = line.trim();

    // Group header: "Build tasks" / "Android tasks" etc (ends with " tasks" or " task")
    if (/^[A-Z][a-zA-Z ]+ tasks$/.test(trimmed)) {
      currentGroup = trimmed.replace(/ tasks$/, "").toLowerCase();
      continue;
    }

    // Task line: "taskName - description" or "project:taskName - description"
    const match = trimmed.match(/^([\w:]+)\s+-\s+(.*)$/);
    if (match) {
      const fullName = match[1];
      const description = match[2];
      const nameParts = fullName.split(":");
      const name = nameParts[nameParts.length - 1];
      const project = nameParts.length > 1 ? nameParts.slice(0, -1).join(":") : ":";
      tasks.push({ name, group: currentGroup, description, project });
    }
  }

  return tasks;
}
