import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectAndroidGradleScripts,
  detectAndroidAppPackage,
  detectAndroidModules,
  inspectAndroidModule,
  listDirectoryChildren,
} from "../src/index.js";

describe("@android-devkit/android-project", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects app package from common manifest locations", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "android-project-"));
    tempDirs.push(projectRoot);

    const manifestDir = join(projectRoot, "app", "src", "main");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "AndroidManifest.xml"),
      '<manifest package="com.example.demo"></manifest>'
    );

    expect(detectAndroidAppPackage(projectRoot)).toBe("com.example.demo");
  });

  it("detects modules from settings.gradle includes", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "android-project-"));
    tempDirs.push(projectRoot);

    mkdirSync(join(projectRoot, "app"), { recursive: true });
    mkdirSync(join(projectRoot, "feature", "chat"), { recursive: true });
    writeFileSync(
      join(projectRoot, "settings.gradle"),
      'include(":app")\ninclude(":feature:chat")\n'
    );

    expect(detectAndroidModules(projectRoot)).toEqual([
      { name: "app", fsPath: join(projectRoot, "app") },
      { name: "feature:chat", fsPath: join(projectRoot, "feature", "chat") },
    ]);
  });

  it("falls back to directories containing Gradle build files", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "android-project-"));
    tempDirs.push(projectRoot);

    mkdirSync(join(projectRoot, "app"), { recursive: true });
    mkdirSync(join(projectRoot, "library"), { recursive: true });
    writeFileSync(join(projectRoot, "app", "build.gradle"), "");
    writeFileSync(join(projectRoot, "library", "build.gradle.kts"), "");

    expect(detectAndroidModules(projectRoot)).toEqual([
      { name: "app", fsPath: join(projectRoot, "app") },
      { name: "library", fsPath: join(projectRoot, "library") },
    ]);
  });

  it("collects Gradle scripts and inspects Android module contents", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "android-project-"));
    tempDirs.push(projectRoot);

    writeFileSync(join(projectRoot, "settings.gradle"), 'include(":app")');
    writeFileSync(join(projectRoot, "build.gradle.kts"), "");
    writeFileSync(join(projectRoot, "gradle.properties"), "");

    const appRoot = join(projectRoot, "app");
    mkdirSync(join(appRoot, "src", "main", "java", "com", "example", "app"), { recursive: true });
    mkdirSync(join(appRoot, "src", "main", "res", "layout"), { recursive: true });
    mkdirSync(join(appRoot, "build", "generated", "res", "pngs"), { recursive: true });
    writeFileSync(join(appRoot, "build.gradle"), "");
    writeFileSync(join(appRoot, "proguard-rules.pro"), "");
    writeFileSync(join(appRoot, "src", "main", "AndroidManifest.xml"), "<manifest />");
    writeFileSync(join(appRoot, "src", "main", "java", "com", "example", "app", "MainActivity.kt"), "");

    expect(collectAndroidGradleScripts(projectRoot)).toEqual([
      { label: "build.gradle.kts", fsPath: join(projectRoot, "build.gradle.kts"), context: `Project: ${projectRoot.split(/[/\\]/).pop()}` },
      { label: "build.gradle", fsPath: join(appRoot, "build.gradle"), context: "Module :app" },
      { label: "proguard-rules.pro", fsPath: join(appRoot, "proguard-rules.pro"), context: "ProGuard Rules for :app" },
      { label: "gradle.properties", fsPath: join(projectRoot, "gradle.properties"), context: "Project Properties" },
      { label: "settings.gradle", fsPath: join(projectRoot, "settings.gradle"), context: "Project Settings" },
    ]);

    expect(inspectAndroidModule(appRoot)).toEqual({
      manifestPath: join(appRoot, "src", "main", "AndroidManifest.xml"),
      sourceRoots: [
        {
          packageName: "com.example.app",
          fsPath: join(appRoot, "src", "main", "java", "com", "example", "app"),
          sourceSet: undefined,
        },
      ],
      resourceDirectories: [join(appRoot, "src", "main", "res", "layout")],
      generatedResourceDirectories: [join(appRoot, "build", "generated", "res", "pngs")],
    });
  });

  it("lists directory children with directories first", () => {
    const root = mkdtempSync(join(tmpdir(), "android-project-"));
    tempDirs.push(root);

    mkdirSync(join(root, "b-dir"), { recursive: true });
    mkdirSync(join(root, "a-dir"), { recursive: true });
    writeFileSync(join(root, "c-file.txt"), "");

    expect(listDirectoryChildren(root)).toEqual([
      { name: "a-dir", fsPath: join(root, "a-dir"), isDirectory: true },
      { name: "b-dir", fsPath: join(root, "b-dir"), isDirectory: true },
      { name: "c-file.txt", fsPath: join(root, "c-file.txt"), isDirectory: false },
    ]);
  });
});
