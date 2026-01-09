import { spawn } from "node:child_process";
import type { AdbOptions, AdbResult } from "./types.js";

/**
 * Low-level ADB client for executing commands
 */
export class AdbClient {
  private adbPath: string;
  private defaultTimeout: number;

  constructor(options: AdbOptions = {}) {
    this.adbPath = options.adbPath ?? "adb";
    this.defaultTimeout = options.timeout ?? 30000;
  }

  /**
   * Execute an ADB command
   */
  async exec(
    args: string[],
    options: { serial?: string; timeout?: number } = {}
  ): Promise<AdbResult> {
    const fullArgs = options.serial ? ["-s", options.serial, ...args] : args;
    const timeout = options.timeout ?? this.defaultTimeout;

    return new Promise((resolve, reject) => {
      const proc = spawn(this.adbPath, fullArgs, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        proc.kill("SIGTERM");
        reject(new Error(`ADB command timed out after ${timeout}ms`));
      }, timeout);

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (!killed) {
          resolve({
            exitCode: code ?? 0,
            stdout,
            stderr,
          });
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Execute an ADB shell command on device
   */
  async shell(
    command: string,
    options: { serial?: string; timeout?: number } = {}
  ): Promise<AdbResult> {
    return this.exec(["shell", command], options);
  }

  /**
   * Get ADB server version
   */
  async version(): Promise<string> {
    const result = await this.exec(["version"]);
    const match = result.stdout.match(/Android Debug Bridge version ([\d.]+)/);
    return match?.[1] ?? "unknown";
  }

  /**
   * Start the ADB server
   */
  async startServer(): Promise<void> {
    await this.exec(["start-server"]);
  }

  /**
   * Kill the ADB server
   */
  async killServer(): Promise<void> {
    await this.exec(["kill-server"]);
  }

  /**
   * Connect to a device over TCP/IP
   */
  async connect(host: string, port: number = 5555): Promise<string> {
    const result = await this.exec(["connect", `${host}:${port}`]);
    return result.stdout.trim();
  }

  /**
   * Disconnect from a TCP/IP device
   */
  async disconnect(host?: string, port?: number): Promise<string> {
    const args = host ? ["disconnect", `${host}:${port ?? 5555}`] : ["disconnect"];
    const result = await this.exec(args);
    return result.stdout.trim();
  }
}
