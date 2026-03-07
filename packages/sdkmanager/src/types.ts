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
