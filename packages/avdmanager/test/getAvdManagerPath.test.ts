import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getAvdManagerPath } from "../src/index.js";

describe("getAvdManagerPath", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prefers cmdline-tools/latest", () => {
    const dir = mkdtempSync(join(tmpdir(), "avdmanager-path-"));
    tempDirs.push(dir);
    const ext = process.platform === "win32" ? ".bat" : "";
    const latestBin = join(dir, "cmdline-tools", "latest", "bin");
    mkdirSync(latestBin, { recursive: true });
    writeFileSync(join(latestBin, `avdmanager${ext}`), "");

    expect(getAvdManagerPath(dir)).toBe(join(latestBin, `avdmanager${ext}`));
  });

  it("falls back to versioned cmdline-tools directories", () => {
    const dir = mkdtempSync(join(tmpdir(), "avdmanager-path-"));
    tempDirs.push(dir);
    const ext = process.platform === "win32" ? ".bat" : "";
    const versionedBin = join(dir, "cmdline-tools", "12.0", "bin");
    mkdirSync(versionedBin, { recursive: true });
    writeFileSync(join(versionedBin, `avdmanager${ext}`), "");

    expect(getAvdManagerPath(dir)).toBe(join(versionedBin, `avdmanager${ext}`));
  });

  it("returns undefined when avdmanager is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "avdmanager-path-"));
    tempDirs.push(dir);
    expect(getAvdManagerPath(dir)).toBeUndefined();
  });
});
