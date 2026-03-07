import { spawn, type ChildProcess, type StdioOptions } from "node:child_process";
import { CommandExecutionError } from "./errors.js";
import type { CommandResult, CommandSpec, StreamingCommand } from "./types.js";

export function mergeEnv(...envs: Array<NodeJS.ProcessEnv | undefined>): NodeJS.ProcessEnv {
  return Object.assign({}, ...envs.filter(Boolean));
}

function resolveStdio(stdio: CommandSpec["stdio"]): StdioOptions {
  if (!stdio) return ["pipe", "pipe", "pipe"];
  return stdio;
}

export function spawnCommand(spec: CommandSpec): ChildProcess {
  return spawn(spec.command, spec.args ?? [], {
    cwd: spec.cwd,
    env: spec.env,
    shell: spec.shell,
    detached: spec.detached,
    stdio: resolveStdio(spec.stdio),
  });
}

export function runStreamingCommand(spec: CommandSpec): StreamingCommand {
  const process = spawnCommand(spec);

  const result = new Promise<CommandResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = spec.timeoutMs
      ? setTimeout(() => {
          settled = true;
          process.kill("SIGTERM");
          reject(
            new CommandExecutionError(`Command timed out after ${spec.timeoutMs}ms`, {
              command: spec.command,
              args: spec.args,
              stdout,
              stderr,
            })
          );
        }, spec.timeoutMs)
      : undefined;

    process.stdout?.on("data", (data: Buffer | string) => {
      stdout += data.toString();
    });

    process.stderr?.on("data", (data: Buffer | string) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (settled) return;
      resolve({
        exitCode: code ?? 0,
        stdout,
        stderr,
      });
    });

    process.on("error", (error) => {
      if (timer) clearTimeout(timer);
      if (settled) return;
      reject(
        new CommandExecutionError(error.message, {
          command: spec.command,
          args: spec.args,
          stdout,
          stderr,
        })
      );
    });

    if (spec.input) {
      process.stdin?.write(spec.input);
      process.stdin?.end();
    }
  });

  return { process, result };
}

export async function runCommand(spec: CommandSpec): Promise<CommandResult> {
  const { result } = runStreamingCommand(spec);
  const commandResult = await result;
  if (commandResult.exitCode !== 0) {
    throw CommandExecutionError.fromResult(spec.command, spec.args ?? [], commandResult);
  }
  return commandResult;
}
