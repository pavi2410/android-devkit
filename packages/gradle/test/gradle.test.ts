import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnCommandMock } = vi.hoisted(() => ({
  spawnCommandMock: vi.fn(),
}));

vi.mock("@android-devkit/tool-core", () => ({
  spawnCommand: spawnCommandMock,
}));

import { findApk, getBuildVariants, getGradlewPath, listTasks, parseGradleTasks } from "../src/index.js";

class FakeProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

describe("gradle package", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    spawnCommandMock.mockReset();
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses grouped gradle task output", () => {
    const tasks = parseGradleTasks([
      "Build tasks",
      "assembleDebug - Assembles the debug build",
      ":app:bundleRelease - Bundles release",
      "",
      "Help tasks",
      "tasks - Displays the tasks runnable from root project",
    ].join("\n"));

    expect(tasks).toEqual([
      { name: "assembleDebug", group: "build", description: "Assembles the debug build", project: ":" },
      { name: "bundleRelease", group: "build", description: "Bundles release", project: ":app" },
      { name: "tasks", group: "help", description: "Displays the tasks runnable from root project", project: ":" },
    ]);
  });

  it("resolves the platform-specific gradle wrapper path", () => {
    const dir = mkdtempSync(join(tmpdir(), "gradle-path-"));
    tempDirs.push(dir);
    const gradlewName = process.platform === "win32" ? "gradlew.bat" : "gradlew";
    writeFileSync(join(dir, gradlewName), "echo gradle");

    expect(getGradlewPath(dir)).toBe(join(dir, gradlewName));
  });

  it("lists tasks by invoking the gradle wrapper", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gradle-list-"));
    tempDirs.push(dir);
    const gradlewName = process.platform === "win32" ? "gradlew.bat" : "gradlew";
    writeFileSync(join(dir, gradlewName), "echo gradle");

    const proc = new FakeProcess();
    spawnCommandMock.mockReturnValue(proc);

    const promise = listTasks(dir);
    proc.stdout.emit("data", "Build tasks\nassembleDebug - Assembles debug\n");
    proc.emit("close", 0);

    await expect(promise).resolves.toEqual([
      { name: "assembleDebug", group: "build", description: "Assembles debug", project: ":" },
    ]);

    expect(spawnCommandMock).toHaveBeenCalledWith({
      command: join(dir, gradlewName),
      args: ["tasks", "--all", "--console=plain"],
      cwd: dir,
      shell: process.platform === "win32",
    });
  });

  it("derives build variants from assemble tasks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gradle-variants-"));
    tempDirs.push(dir);
    const gradlewName = process.platform === "win32" ? "gradlew.bat" : "gradlew";
    writeFileSync(join(dir, gradlewName), "echo gradle");

    const proc = new FakeProcess();
    spawnCommandMock.mockReturnValue(proc);

    const promise = getBuildVariants(dir);
    proc.stdout.emit("data", [
      "Build tasks",
      "assemble - Assembles all variants",
      "assembleDebug - Assembles debug",
      "assembleRelease - Assembles release",
      "",
    ].join("\n"));
    proc.emit("close", 0);

    await expect(promise).resolves.toEqual([
      { name: "Debug", assembleTask: "assembleDebug", module: "app" },
      { name: "Release", assembleTask: "assembleRelease", module: "app" },
    ]);
  });

  it("finds APK outputs for a variant", () => {
    const dir = mkdtempSync(join(tmpdir(), "gradle-apk-"));
    tempDirs.push(dir);
    const apkDir = join(dir, "app", "build", "outputs", "apk", "debug");
    mkdirSync(apkDir, { recursive: true });
    const apkPath = join(apkDir, "app-debug.apk");
    writeFileSync(apkPath, "binary");

    expect(findApk(dir, { name: "Debug", assembleTask: "assembleDebug", module: "app" })).toBe(apkPath);
  });
});
