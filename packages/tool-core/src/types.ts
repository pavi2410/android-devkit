import type { ChildProcess } from "node:child_process";

export interface CommandSpec {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  shell?: boolean;
  timeoutMs?: number;
  input?: string;
  detached?: boolean;
  stdio?: "pipe" | "ignore" | Array<"pipe" | "ignore">;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface StreamingCommand {
  process: ChildProcess;
  result: Promise<CommandResult>;
}
