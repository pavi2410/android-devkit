// Core client
export { AdbClient } from "./client.js";

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
  AdbResult,
} from "./types.js";
