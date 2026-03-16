import * as fs from "node:fs";
import * as path from "node:path";

export interface AndroidModule {
  name: string;
  fsPath: string;
}

export interface AndroidSourceRoot {
  packageName: string;
  fsPath: string;
  sourceSet?: string;
}

export interface AndroidGradleScript {
  label: string;
  fsPath: string;
  context?: string;
}

export interface AndroidModuleInspection {
  manifestPath?: string;
  sourceRoots: AndroidSourceRoot[];
  resourceDirectories: string[];
  generatedResourceDirectories: string[];
}

export function detectAndroidAppPackage(projectRoot: string, module?: string): string | undefined {
  // If a specific module is given, check it first
  const moduleDirs = module
    ? [path.join(projectRoot, module.replace(/:/g, path.sep))]
    : [path.join(projectRoot, "app"), projectRoot];

  for (const moduleDir of moduleDirs) {
    // Try build.gradle(.kts) first — modern projects define applicationId/namespace there
    for (const ext of ["build.gradle.kts", "build.gradle"]) {
      const detected = detectGradleAppId(path.join(moduleDir, ext));
      if (detected) return detected;
    }

    // Fall back to AndroidManifest.xml package attribute
    const detected = detectManifestPackage(path.join(moduleDir, "src", "main", "AndroidManifest.xml"));
    if (detected) return detected;
  }

  // Last resort: bare manifest at project root
  if (!module) {
    const detected = detectManifestPackage(path.join(projectRoot, "AndroidManifest.xml"));
    if (detected) return detected;
  }

  return undefined;
}

function detectGradleAppId(gradleFile: string): string | undefined {
  if (!fs.existsSync(gradleFile)) return undefined;
  const content = fs.readFileSync(gradleFile, "utf-8");

  // Match: applicationId = "com.example.app" or applicationId "com.example.app"
  const appIdMatch = content.match(/applicationId\s*[=(]\s*["']([^"']+)["']/);
  if (appIdMatch) return appIdMatch[1];

  // Match: namespace = "com.example.app" or namespace "com.example.app"
  const nsMatch = content.match(/namespace\s*[=(]\s*["']([^"']+)["']/);
  if (nsMatch) return nsMatch[1];

  return undefined;
}

export function detectManifestPackage(manifestPath: string): string | undefined {
  if (!fs.existsSync(manifestPath)) return undefined;
  const content = fs.readFileSync(manifestPath, "utf-8");
  const match = content.match(/package\s*=\s*["']([^"']+)["']/);
  return match?.[1];
}

export function detectAndroidModules(projectRoot: string): AndroidModule[] {
  const modules: AndroidModule[] = [];
  const settingsFiles = [
    path.join(projectRoot, "settings.gradle.kts"),
    path.join(projectRoot, "settings.gradle"),
  ];

  let parsedFromSettings = false;
  for (const settingsFile of settingsFiles) {
    if (!fs.existsSync(settingsFile)) continue;
    const content = fs.readFileSync(settingsFile, "utf8");
    const includeMatches = [...content.matchAll(/include\s*\(\s*["']([^"']+)["']\s*\)/g)];
    for (const match of includeMatches) {
      const rawName = match[1];
      const relativeModulePath = rawName.replace(/^:/, "").replace(/:/g, path.sep);
      const modulePath = path.join(projectRoot, relativeModulePath);
      if (fs.existsSync(modulePath)) {
        modules.push({ name: rawName.replace(/^:/, ""), fsPath: modulePath });
      }
    }
    if (modules.length > 0) {
      parsedFromSettings = true;
      break;
    }
  }

  if (!parsedFromSettings) {
    for (const entry of safeReadDir(projectRoot)) {
      const fullPath = path.join(projectRoot, entry);
      if (!isDirectory(fullPath)) continue;
      if (
        fs.existsSync(path.join(fullPath, "build.gradle.kts")) ||
        fs.existsSync(path.join(fullPath, "build.gradle"))
      ) {
        modules.push({ name: entry, fsPath: fullPath });
      }
    }
  }

  return dedupeModules(modules);
}

export function inspectAndroidModule(modulePath: string): AndroidModuleInspection {
  const srcMain = path.join(modulePath, "src", "main");
  const manifestPath = path.join(srcMain, "AndroidManifest.xml");
  const sourceRoots = [
    { dir: path.join(srcMain, "java"), sourceSet: undefined },
    { dir: path.join(srcMain, "kotlin"), sourceSet: undefined },
    { dir: path.join(modulePath, "src", "androidTest", "java"), sourceSet: "androidTest" },
    { dir: path.join(modulePath, "src", "androidTest", "kotlin"), sourceSet: "androidTest" },
    { dir: path.join(modulePath, "src", "test", "java"), sourceSet: "test" },
    { dir: path.join(modulePath, "src", "test", "kotlin"), sourceSet: "test" },
  ].flatMap(({ dir, sourceSet }) => {
    if (!fs.existsSync(dir)) return [] as AndroidSourceRoot[];
    return getTopPackageRoots(dir).map((root) => ({ ...root, sourceSet }));
  });

  const resourceDirectories = collectDirectories(path.join(srcMain, "res"));
  const generatedResourceDirectories = collectDirectories(path.join(modulePath, "build", "generated", "res"));

  return {
    manifestPath: fs.existsSync(manifestPath) ? manifestPath : undefined,
    sourceRoots,
    resourceDirectories,
    generatedResourceDirectories,
  };
}

export function collectAndroidGradleScripts(projectRoot: string): AndroidGradleScript[] {
  const scripts: AndroidGradleScript[] = [];
  const addScript = (filePath: string, label: string, context?: string) => {
    if (fs.existsSync(filePath)) {
      scripts.push({ label, fsPath: filePath, context });
    }
  };

  const projectName = path.basename(projectRoot);
  addScript(path.join(projectRoot, "build.gradle.kts"), "build.gradle.kts", `Project: ${projectName}`);
  addScript(path.join(projectRoot, "build.gradle"), "build.gradle", `Project: ${projectName}`);

  for (const module of detectAndroidModules(projectRoot)) {
    addScript(path.join(module.fsPath, "build.gradle.kts"), "build.gradle.kts", `Module :${module.name}`);
    addScript(path.join(module.fsPath, "build.gradle"), "build.gradle", `Module :${module.name}`);
    addScript(path.join(module.fsPath, "proguard-rules.pro"), "proguard-rules.pro", `ProGuard Rules for :${module.name}`);
  }

  addScript(path.join(projectRoot, "gradle.properties"), "gradle.properties", "Project Properties");
  addScript(
    path.join(projectRoot, "gradle", "wrapper", "gradle-wrapper.properties"),
    "gradle-wrapper.properties",
    "Gradle Version"
  );
  addScript(path.join(projectRoot, "gradle", "libs.versions.toml"), "libs.versions.toml", 'Version Catalog "libs"');
  addScript(path.join(projectRoot, "local.properties"), "local.properties", "SDK Location");
  addScript(path.join(projectRoot, "settings.gradle.kts"), "settings.gradle.kts", "Project Settings");
  addScript(path.join(projectRoot, "settings.gradle"), "settings.gradle", "Project Settings");

  return scripts;
}

export function listDirectoryEntries(dir: string): string[] {
  return safeReadDir(dir);
}

export function listDirectoryChildren(dir: string): { name: string; fsPath: string; isDirectory: boolean }[] {
  return safeReadDir(dir)
    .map((name) => {
      const fsPath = path.join(dir, name);
      return {
        name,
        fsPath,
        isDirectory: isDirectory(fsPath),
      };
    })
    .sort((left, right) => {
      if (left.isDirectory && !right.isDirectory) return -1;
      if (!left.isDirectory && right.isDirectory) return 1;
      return left.name.localeCompare(right.name);
    });
}

function collectDirectories(dir: string): string[] {
  return safeReadDir(dir)
    .map((entry) => path.join(dir, entry))
    .filter(isDirectory)
    .sort();
}

function safeReadDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function isDirectory(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function getTopPackageRoots(dir: string): Array<{ packageName: string; fsPath: string }> {
  const entries = safeReadDir(dir).filter((entry) => isDirectory(path.join(dir, entry)));
  if (entries.length === 0) return [];

  return entries.map((entry) => {
    let currentPath = path.join(dir, entry);
    let packageName = entry;

    while (true) {
      const children = safeReadDir(currentPath).filter((child) =>
        isDirectory(path.join(currentPath, child))
      );
      const files = safeReadDir(currentPath).filter((child) =>
        !isDirectory(path.join(currentPath, child))
      );

      if (children.length === 1 && files.length === 0) {
        packageName = `${packageName}.${children[0]}`;
        currentPath = path.join(currentPath, children[0]);
        continue;
      }

      break;
    }

    return { packageName, fsPath: currentPath };
  });
}

function dedupeModules(modules: AndroidModule[]): AndroidModule[] {
  const seen = new Set<string>();
  return modules.filter((module) => {
    const key = `${module.name}:${module.fsPath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
