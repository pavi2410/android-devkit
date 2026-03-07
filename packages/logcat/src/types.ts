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
  adbPath?: string;
  serial?: string;
  minLevel?: LogLevel;
  tags?: string[];
  pid?: number;
  clear?: boolean;
}
