import type { CommandResult } from "./types.js";

export class CommandExecutionError extends Error {
  readonly command: string;
  readonly args: string[];
  readonly exitCode?: number;
  readonly stdout?: string;
  readonly stderr?: string;

  constructor(
    message: string,
    options: {
      command: string;
      args?: string[];
      exitCode?: number;
      stdout?: string;
      stderr?: string;
    }
  ) {
    super(message);
    this.name = "CommandExecutionError";
    this.command = options.command;
    this.args = options.args ?? [];
    this.exitCode = options.exitCode;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
  }

  static fromResult(command: string, args: string[], result: CommandResult): CommandExecutionError {
    return new CommandExecutionError(
      `${command} ${args.join(" ")} exited with code ${result.exitCode}`,
      {
        command,
        args,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      }
    );
  }
}
