import * as fs from "node:fs";
import * as path from "node:path";

export interface ResolveAndroidSdkPathOptions {
  configuredPath?: string;
  env?: NodeJS.ProcessEnv;
}

function resolveExistingPath(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  return fs.existsSync(candidate) ? candidate : undefined;
}

function getToolExtension(kind: "binary" | "script"): string {
  if (process.platform !== "win32") return "";
  return kind === "script" ? ".bat" : ".exe";
}

export function resolveAndroidSdkPath(options: ResolveAndroidSdkPathOptions = {}): string | undefined {
  const env = options.env ?? process.env;
  const configuredPath = options.configuredPath?.trim();

  const explicitPath = resolveExistingPath(configuredPath);
  if (explicitPath) return explicitPath;

  for (const envPath of [env.ANDROID_HOME, env.ANDROID_SDK_ROOT]) {
    const existingEnvPath = resolveExistingPath(envPath);
    if (existingEnvPath) return existingEnvPath;
  }

  const home = env.HOME ?? env.USERPROFILE ?? "";
  const localAppData = env.LOCALAPPDATA ?? "";
  const candidates = [
    path.join(home, "Library", "Android", "sdk"),
    path.join(home, "Android", "Sdk"),
    path.join(localAppData, "Android", "Sdk"),
    "/opt/homebrew/share/android-commandlinetools",
    "/usr/local/android-sdk",
    "/opt/android-sdk",
  ];

  for (const candidate of candidates) {
    const existingCandidate = resolveExistingPath(candidate);
    if (existingCandidate) return existingCandidate;
  }

  return undefined;
}

export function getPlatformToolsDir(sdkPath: string): string | undefined {
  return resolveExistingPath(path.join(sdkPath, "platform-tools"));
}

export function getEmulatorDir(sdkPath: string): string | undefined {
  return resolveExistingPath(path.join(sdkPath, "emulator"));
}

export function getCommandLineToolsBinPath(sdkPath: string): string | undefined {
  const latestBin = path.join(sdkPath, "cmdline-tools", "latest", "bin");
  const existingLatestBin = resolveExistingPath(latestBin);
  if (existingLatestBin) return existingLatestBin;

  const cmdlineToolsDir = path.join(sdkPath, "cmdline-tools");
  if (!fs.existsSync(cmdlineToolsDir)) return undefined;

  for (const entry of fs.readdirSync(cmdlineToolsDir)) {
    if (entry === "latest") continue;
    const candidate = path.join(cmdlineToolsDir, entry, "bin");
    const existingCandidate = resolveExistingPath(candidate);
    if (existingCandidate) return existingCandidate;
  }

  return undefined;
}

export function getSdkToolDirectories(sdkPath: string): string[] {
  const dirs: string[] = [];

  const platformToolsDir = getPlatformToolsDir(sdkPath);
  if (platformToolsDir) dirs.push(platformToolsDir);

  const emulatorDir = getEmulatorDir(sdkPath);
  if (emulatorDir) dirs.push(emulatorDir);

  const commandLineToolsBinPath = getCommandLineToolsBinPath(sdkPath);
  if (commandLineToolsBinPath) dirs.push(commandLineToolsBinPath);

  return dirs;
}

export function resolveCommandLineToolPath(sdkPath: string, toolName: string): string | undefined {
  const binPath = getCommandLineToolsBinPath(sdkPath);
  if (!binPath) return undefined;
  return resolveExistingPath(path.join(binPath, `${toolName}${getToolExtension("script")}`));
}

export function resolvePlatformToolPath(sdkPath: string, toolName: string): string | undefined {
  const platformToolsDir = getPlatformToolsDir(sdkPath);
  if (!platformToolsDir) return undefined;
  return resolveExistingPath(path.join(platformToolsDir, `${toolName}${getToolExtension("binary")}`));
}

export function resolveEmulatorToolPath(sdkPath: string, toolName: string): string | undefined {
  const emulatorDir = getEmulatorDir(sdkPath);
  if (!emulatorDir) return undefined;
  return resolveExistingPath(path.join(emulatorDir, `${toolName}${getToolExtension("binary")}`));
}
