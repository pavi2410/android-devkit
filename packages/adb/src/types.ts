/**
 * Device connection state from ADB
 */
export type DeviceState =
  | "device" // Connected and ready
  | "offline" // Not responding
  | "unauthorized" // USB debugging not authorized
  | "authorizing" // Waiting for authorization
  | "no permissions" // Missing USB permissions
  | "bootloader" // In bootloader mode
  | "recovery" // In recovery mode
  | "sideload" // In sideload mode
  | "unknown";

/**
 * How the device is connected
 */
export type ConnectionType = "usb" | "emulator" | "tcpip" | "wireless";

/**
 * Represents an Android device connected via ADB
 */
export interface Device {
  /** Device serial number or IP:port for network devices */
  serial: string;
  /** Current device state */
  state: DeviceState;
  /** Device model name (e.g., "Pixel 7") */
  model?: string;
  /** Device product name (e.g., "panther") */
  product?: string;
  /** Device name */
  device?: string;
  /** Transport ID from ADB server */
  transportId: bigint;
  /** Whether this is an emulator */
  isEmulator: boolean;
  /** How the device is connected */
  connectionType: ConnectionType;
}

/**
 * Options for creating an AdbClient
 */
export interface AdbClientOptions {
  /** Path to ADB binary (for server start and fallback operations) */
  adbPath?: string;
  /** Android SDK root used to auto-resolve ADB from platform-tools */
  sdkPath?: string;
  /** ADB server host (defaults to "127.0.0.1") */
  serverHost?: string;
  /** ADB server port (defaults to 5037) */
  serverPort?: number;
}

/**
 * Options for resolving ADB path
 */
export interface ResolveAdbPathOptions {
  adbPath?: string;
  sdkPath?: string;
}
