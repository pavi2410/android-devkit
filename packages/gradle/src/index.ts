import * as fs from "node:fs";
import * as path from "node:path";
import { runStreamingCommand, spawnCommand, type StreamingCommand } from "@android-devkit/tool-core";

export interface GradleTask {
  name: string;
  group: string;
  description: string;
  project: string;
}

export interface BuildVariant {
  name: string;
  assembleTask: string;
  module: string;
}

export function getGradlewPath(projectFolder: string): string | undefined {
  const gradlew = process.platform === "win32"
    ? path.join(projectFolder, "gradlew.bat")
    : path.join(projectFolder, "gradlew");
  return fs.existsSync(gradlew) ? gradlew : undefined;
}

export function parseGradleTasks(output: string): GradleTask[] {
  const tasks: GradleTask[] = [];
  let currentGroup = "other";

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (/^[A-Z][a-zA-Z ]+ tasks$/.test(trimmed)) {
      currentGroup = trimmed.replace(/ tasks$/, "").toLowerCase();
      continue;
    }

    const match = trimmed.match(/^([\w:]+)\s+-\s+(.*)$/);
    if (!match) continue;

    const fullName = match[1];
    const description = match[2];
    const nameParts = fullName.split(":");
    const name = nameParts[nameParts.length - 1];
    const project = nameParts.length > 1 ? nameParts.slice(0, -1).join(":") : ":";
    tasks.push({ name, group: currentGroup, description, project });
  }

  return tasks;
}

export async function listTasks(projectFolder: string): Promise<GradleTask[]> {
  const gradlew = getGradlewPath(projectFolder);
  if (!gradlew) throw new Error("No gradlew found in workspace root.");

  const proc = spawnCommand({
    command: gradlew,
    args: ["tasks", "--all", "--console=plain"],
    cwd: projectFolder,
    shell: process.platform === "win32",
  });

  return await new Promise<GradleTask[]>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d: Buffer | string) => (stdout += d.toString()));
    proc.stderr?.on("data", (d: Buffer | string) => (stderr += d.toString()));
    proc.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`gradlew tasks failed (code ${code}): ${stderr}`));
        return;
      }
      resolve(parseGradleTasks(stdout));
    });
    proc.on("error", reject);
  });
}

export async function getBuildVariants(projectFolder: string): Promise<BuildVariant[]> {
  const tasks = await listTasks(projectFolder);
  const seen = new Set<string>();
  return tasks
    .filter((task) => task.name.startsWith("assemble") && task.name !== "assemble")
    .filter((task) => {
      // Deduplicate: prefer module-specific tasks over root-level ones
      const key = `${task.project}:${task.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((task) => {
      const module = task.project === ":" ? "app" : task.project.replace(/^:/, "");
      const fullTask = task.project === ":" ? task.name : `${task.project}:${task.name}`;
      return {
        name: task.name.replace(/^assemble/, ""),
        assembleTask: fullTask,
        module,
      };
    });
}

export function runTask(projectFolder: string, taskName: string): StreamingCommand {
  const gradlew = getGradlewPath(projectFolder);
  if (!gradlew) throw new Error("No gradlew found in workspace root.");

  return runStreamingCommand({
    command: gradlew,
    args: [taskName, "--console=rich"],
    cwd: projectFolder,
    shell: process.platform === "win32",
  });
}

export function findApk(projectFolder: string, variant: BuildVariant): string | undefined {
  const variantLower = variant.name.toLowerCase();
  const modulePath = variant.module.replace(/:/g, path.sep);
  const moduleDir = path.join(projectFolder, modulePath);
  const moduleName = path.basename(modulePath);
  const candidates = [
    path.join(moduleDir, "build", "outputs", "apk", variantLower, `${moduleName}-${variantLower}.apk`),
    path.join(moduleDir, "build", "outputs", "apk", variantLower, `${moduleName}-${variantLower}-unsigned.apk`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}
