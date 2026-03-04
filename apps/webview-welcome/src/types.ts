export type MessageToWebview =
  | { type: "init"; sdkPath: string | null; version: string }
  | { type: "sdkPathUpdated"; path: string };

export type MessageToHost =
  | { type: "selectSdkPath" }
  | { type: "openView"; viewId: string }
  | { type: "openExternal"; url: string };
