import type { SdkPackage } from "../types";
import { ANDROID_VERSION_NAMES } from "./android-versions";

const PLATFORM_CATEGORIES = new Set(["platforms", "system-images", "sources"]);

const TOOL_FAMILIES: Record<string, string> = {
  "build-tools": "Android SDK Build-Tools",
  ndk: "NDK (Side by side)",
  "ndk-bundle": "NDK",
  cmake: "CMake",
  "cmdline-tools": "Android SDK Command-line Tools",
  extras: "Extras",
};

export type GroupStatus = "installed" | "partial" | "not_installed" | "update";

export interface PlatformGroup {
  apiKey: string;
  label: string;
  packages: SdkPackage[];
}

export interface ToolGroup {
  family: string;
  label: string;
  packages: SdkPackage[];
  singleton: boolean;
}

export function extractApiKey(id: string): string | null {
  const match = id.match(/android-([^;]+)/);
  return match ? match[1] : null;
}

function apiKeyToSortNum(key: string): number {
  const parsed = parseFloat(key);
  return Number.isNaN(parsed) ? -1 : parsed;
}

function getToolFamily(id: string): string {
  if (id === "platform-tools") return "platform-tools";
  if (id === "emulator") return "emulator";
  if (id === "ndk-bundle") return "ndk-bundle";
  return id.split(";")[0];
}

function getToolFamilyLabel(family: string): string {
  if (family === "platform-tools") return "Android SDK Platform-Tools";
  if (family === "emulator") return "Android Emulator";
  return TOOL_FAMILIES[family] ?? family;
}

export function hasRealUpdate(pkg: SdkPackage): boolean {
  return Boolean(pkg.availableVersion && pkg.availableVersion !== pkg.installedVersion);
}

export function groupStatus(packages: SdkPackage[]): GroupStatus {
  const installedCount = packages.filter((pkg) => pkg.installed).length;
  const hasUpdate = packages.some(hasRealUpdate);

  if (installedCount === 0) return "not_installed";
  if (hasUpdate) return "update";
  if (installedCount === packages.length) return "installed";
  return "partial";
}

export function buildPlatformGroups(packages: SdkPackage[]): PlatformGroup[] {
  const groupsByApiKey = new Map<string, SdkPackage[]>();

  for (const pkg of packages) {
    if (!PLATFORM_CATEGORIES.has(pkg.category)) continue;
    const key = extractApiKey(pkg.id) ?? "unknown";
    const current = groupsByApiKey.get(key) ?? [];
    current.push(pkg);
    groupsByApiKey.set(key, current);
  }

  const groups: PlatformGroup[] = [];
  for (const [apiKey, sdkPackages] of groupsByApiKey) {
    groups.push({
      apiKey,
      label: ANDROID_VERSION_NAMES[apiKey] ?? `Android API ${apiKey}`,
      packages: sdkPackages,
    });
  }

  groups.sort((left, right) => {
    const leftNum = apiKeyToSortNum(left.apiKey);
    const rightNum = apiKeyToSortNum(right.apiKey);

    if (leftNum !== -1 && rightNum !== -1) return rightNum - leftNum;
    if (leftNum === -1 && rightNum === -1) return left.apiKey < right.apiKey ? 1 : -1;
    return leftNum === -1 ? -1 : 1;
  });

  return groups;
}

export function buildToolGroups(packages: SdkPackage[]): ToolGroup[] {
  const groupsByFamily = new Map<string, SdkPackage[]>();

  for (const pkg of packages) {
    if (PLATFORM_CATEGORIES.has(pkg.category)) continue;
    const family = getToolFamily(pkg.id);
    const current = groupsByFamily.get(family) ?? [];
    current.push(pkg);
    groupsByFamily.set(family, current);
  }

  const singletonFamilies = new Set(["platform-tools", "emulator"]);
  const groups: ToolGroup[] = [];

  for (const [family, sdkPackages] of groupsByFamily) {
    groups.push({
      family,
      label: getToolFamilyLabel(family),
      packages: sdkPackages,
      singleton: singletonFamilies.has(family) || sdkPackages.length === 1,
    });
  }

  groups.sort((left, right) => {
    if (left.singleton !== right.singleton) return left.singleton ? 1 : -1;
    return left.label.localeCompare(right.label);
  });

  return groups;
}
