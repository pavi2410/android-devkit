import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommandExecutionError } from "../src/errors.js";
import { mergeEnv, runCommand, runStreamingCommand } from "../src/runner.js";

describe("tool-core runner", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges env objects with later values taking precedence", () => {
    const merged = mergeEnv({ FOO: "1", BAR: "a" }, { BAR: "b", BAZ: "2" });
    expect(merged).toMatchObject({ FOO: "1", BAR: "b", BAZ: "2" });
  });

  it("runs a command and captures stdout", async () => {
    const result = await runCommand({
      command: process.execPath,
      args: ["-e", 'process.stdout.write("ok")'],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("ok");
    expect(result.stderr).toBe("");
  });

  it("throws CommandExecutionError for non-zero exit codes", async () => {
    await expect(() =>
      runCommand({
        command: process.execPath,
        args: ["-e", 'process.stdout.write("before"); process.stderr.write("boom"); process.exit(3)'],
      })
    ).rejects.toMatchObject({
      name: "CommandExecutionError",
      exitCode: 3,
      stdout: "before",
      stderr: "boom",
    } satisfies Partial<CommandExecutionError>);
  });

  it("supports stdin input in streaming commands", async () => {
    const { result } = runStreamingCommand({
      command: process.execPath,
      args: ["-e", 'process.stdin.on("data", d => process.stdout.write(String(d).trim().toUpperCase()));'],
      input: "hello\n",
    });

    await expect(result).resolves.toMatchObject({
      exitCode: 0,
      stdout: "HELLO",
      stderr: "",
    });
  });

  it("times out long-running commands", async () => {
    await expect(() =>
      runCommand({
        command: process.execPath,
        args: ["-e", "setTimeout(() => {}, 1000)"],
        timeoutMs: 50,
      })
    ).rejects.toThrow("timed out");
  });

  it("passes cwd to child processes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tool-core-runner-"));
    tempDirs.push(dir);

    const result = await runCommand({
      command: process.execPath,
      args: ["-e", "process.stdout.write(process.cwd())"],
      cwd: dir,
    });

    expect(result.stdout).toBe(dir);
  });
});
