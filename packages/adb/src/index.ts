// Core client
export { AdbClient, resolveAdbPath } from "./client.js";

// Device management
export {
  getDevices,
  getDeviceProps,
  getDeviceName,
  getApiLevel,
  getAndroidVersion,
  takeScreenshot,
  reboot,
  installApk,
  uninstallPackage,
  launchApp,
  forceStopApp,
  pairDevice,
  listMdnsServices,
  isMdnsSupported,
  enableTcpip,
  listPackages,
  getPidForPackage,
  listFiles,
  pullFile,
  pushFile,
  deleteFile,
} from "./devices.js";

// Types
export type {
  Device,
  DeviceState,
  ConnectionType,
  TransportType,
  AdbOptions,
  ResolveAdbPathOptions,
  AdbResult,
} from "./types.js";
