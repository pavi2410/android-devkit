export type SdkPackageCategory =
  | "platforms"
  | "build-tools"
  | "platform-tools"
  | "cmdline-tools"
  | "system-images"
  | "extras"
  | "emulator"
  | "ndk"
  | "sources"
  | "cmake"
  | "other";

export interface SdkPackage {
  id: string;
  displayName: string;
  version: string;
  installed: boolean;
  category: SdkPackageCategory;
  installedVersion?: string;
  availableVersion?: string;
  obsolete?: boolean;
}

export type MessageToHost =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "install"; id: string }
  | { type: "uninstall"; id: string }
  | { type: "updateAll" }
  | { type: "applyChanges"; install: string[]; uninstall: string[] };

export type MessageToWebview =
  | { type: "packages"; packages: SdkPackage[]; loading: boolean }
  | { type: "installing"; id: string }
  | { type: "installed"; id: string; success: boolean; error?: string }
  | { type: "uninstalling"; id: string }
  | { type: "uninstalled"; id: string; success: boolean; error?: string }
  | { type: "updatingAll" }
  | { type: "updatedAll"; success: boolean; error?: string };
