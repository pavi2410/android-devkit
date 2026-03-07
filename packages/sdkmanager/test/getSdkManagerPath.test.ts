import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getSdkManagerPath } from "../src/index.js";

describe("getSdkManagerPath", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prefers cmdline-tools/latest", () => {
    const dir = mkdtempSync(join(tmpdir(), "sdkmanager-path-"));
    tempDirs.push(dir);
    const ext = process.platform === "win32" ? ".bat" : "";
    const latestBin = join(dir, "cmdline-tools", "latest", "bin");
    mkdirSync(latestBin, { recursive: true });
    writeFileSync(join(latestBin, `sdkmanager${ext}`), "");

    expect(getSdkManagerPath(dir)).toBe(join(latestBin, `sdkmanager${ext}`));
  });

  it("falls back to versioned cmdline-tools directories", () => {
    const dir = mkdtempSync(join(tmpdir(), "sdkmanager-path-"));
    tempDirs.push(dir);
    const ext = process.platform === "win32" ? ".bat" : "";
    const versionedBin = join(dir, "cmdline-tools", "12.0", "bin");
    mkdirSync(versionedBin, { recursive: true });
    writeFileSync(join(versionedBin, `sdkmanager${ext}`), "");

    expect(getSdkManagerPath(dir)).toBe(join(versionedBin, `sdkmanager${ext}`));
  });

  it("returns undefined when sdkmanager is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "sdkmanager-path-"));
    tempDirs.push(dir);
    expect(getSdkManagerPath(dir)).toBeUndefined();
  });
});
