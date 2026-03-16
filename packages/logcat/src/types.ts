export type LogLevel = "V" | "D" | "I" | "W" | "E" | "F" | "S";

export interface LogcatEntry {
  timestamp: Date;
  pid: number;
  tid: number;
  level: LogLevel;
  tag: string;
  message: string;
}

export interface LogcatOptions {
  /** Minimum log level to emit */
  minLevel?: LogLevel;
  /** Filter by PID */
  pid?: number;
}
