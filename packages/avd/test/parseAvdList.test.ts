import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { parseAvdList } from "../src/index.js";

const fixture = readFileSync(
  join(import.meta.dirname, "fixtures/avdmanager__list_avd.txt"),
  "utf-8"
);

const windowsFixture = readFileSync(
  join(import.meta.dirname, "fixtures/avdmanager__list_avd_windows.txt"),
  "utf-8"
);

describe("parseAvdList", () => {
  it("parses without throwing", () => {
    expect(() => parseAvdList(fixture)).not.toThrow();
  });

  it("returns a non-empty list", () => {
    const avds = parseAvdList(fixture);
    expect(avds.length).toBeGreaterThan(0);
  });

  it("extracts AVD name", () => {
    const avds = parseAvdList(fixture);
    const avd = avds.find((a) => a.name === "Medium_Phone");
    expect(avd).toBeDefined();
  });

  it("extracts device profile", () => {
    const avds = parseAvdList(fixture);
    const avd = avds.find((a) => a.name === "Medium_Phone");
    expect(avd?.device).toContain("medium_phone");
  });

  it("extracts ABI", () => {
    const avds = parseAvdList(fixture);
    const avd = avds.find((a) => a.name === "Medium_Phone");
    expect(avd?.abi).toBe("google_apis_playstore/arm64-v8a");
  });

  it("extracts path", () => {
    const avds = parseAvdList(fixture);
    const avd = avds.find((a) => a.name === "Medium_Phone");
    expect(avd?.path).toContain("Medium_Phone.avd");
  });

  it("extracts target", () => {
    const avds = parseAvdList(fixture);
    const avd = avds.find((a) => a.name === "Medium_Phone");
    expect(avd?.target).toBeTruthy();
  });

  it("parses multiple Windows AVD entries", () => {
    const avds = parseAvdList(windowsFixture);
    expect(avds).toHaveLength(2);
    expect(avds.map((avd) => avd.name)).toEqual(["amper-36", "Pixel_9_API_35"]);
  });

  it("extracts Windows paths and API levels", () => {
    const avds = parseAvdList(windowsFixture);
    const amper = avds.find((avd) => avd.name === "amper-36");
    const pixel = avds.find((avd) => avd.name === "Pixel_9_API_35");

    expect(amper?.path).toContain("amper-36.avd");
    expect(amper?.api).toBeGreaterThan(0);
    expect(amper?.target).toBeTruthy();

    expect(pixel?.path).toContain("Pixel_9_API_35.avd");
    expect(pixel?.api).toBeGreaterThan(0);
    expect(pixel?.abi).toContain("x86_64");
    expect(pixel?.device).toContain("pixel_9");
  });

  it("handles empty output", () => {
    expect(parseAvdList("")).toEqual([]);
  });

  it("handles output with no AVDs", () => {
    expect(parseAvdList("Available Android Virtual Devices:\n")).toEqual([]);
  });
});
