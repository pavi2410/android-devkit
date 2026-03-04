export type SdkPackageCategory =
  | "platforms"
  | "build-tools"
  | "platform-tools"
  | "cmdline-tools"
  | "system-images"
  | "extras"
  | "other";

export interface SdkPackage {
  id: string;
  displayName: string;
  version: string;
  installed: boolean;
  category: SdkPackageCategory;
}
