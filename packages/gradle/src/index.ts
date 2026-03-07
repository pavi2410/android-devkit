import * as fs from "node:fs";
import * as path from "node:path";
import { spawnCommand } from "@android-devkit/tool-core";

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
  return tasks
    .filter((task) => task.name.startsWith("assemble") && task.name !== "assemble")
    .map((task) => ({
      name: task.name.replace(/^assemble/, ""),
      assembleTask: task.name,
    }));
}

export function findApk(projectFolder: string, variant: BuildVariant): string | undefined {
  const variantLower = variant.name.toLowerCase();
  const candidates = [
    path.join(projectFolder, "app", "build", "outputs", "apk", variantLower, `app-${variantLower}.apk`),
    path.join(projectFolder, "app", "build", "outputs", "apk", variantLower, `app-${variantLower}-unsigned.apk`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}
