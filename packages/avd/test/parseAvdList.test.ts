import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { parseAvdList } from "../src/index.js";

const fixture = readFileSync(
  join(import.meta.dirname, "fixtures/avdmanager__list_avd.txt"),
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

  it("handles empty output", () => {
    expect(parseAvdList("")).toEqual([]);
  });

  it("handles output with no AVDs", () => {
    expect(parseAvdList("Available Android Virtual Devices:\n")).toEqual([]);
  });
});
