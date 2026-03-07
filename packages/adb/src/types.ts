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
 * Device transport type
 */
export type TransportType = "usb" | "local" | "any";

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
  /** Transport ID */
  transportId?: string;
  /** Whether this is an emulator */
  isEmulator: boolean;
  /** How the device is connected */
  connectionType: ConnectionType;
}

/**
 * Options for running ADB commands
 */
export interface AdbOptions {
  /** Path to ADB binary (defaults to "adb" in PATH) */
  adbPath?: string;
  /** Target device serial (uses -s flag) */
  serial?: string;
  /** Command timeout in milliseconds */
  timeout?: number;
}

/**
 * Result of an ADB command execution
 */
export interface AdbResult {
  /** Exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
}
