import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { parseDeviceProfiles } from "../src/index.js";

const fixture = readFileSync(
  join(import.meta.dirname, "fixtures/avdmanager__list_device.txt"),
  "utf-8"
);

describe("parseDeviceProfiles", () => {
  it("parses without throwing", () => {
    expect(() => parseDeviceProfiles(fixture)).not.toThrow();
  });

  it("returns a non-empty list", () => {
    const profiles = parseDeviceProfiles(fixture);
    expect(profiles.length).toBeGreaterThan(0);
  });

  it("extracts correct number of profiles", () => {
    const profiles = parseDeviceProfiles(fixture);
    // Fixture has 83 device definitions (id 0 through 82)
    expect(profiles.length).toBe(83);
  });

  it("extracts id correctly", () => {
    const profiles = parseDeviceProfiles(fixture);
    const pixel9 = profiles.find((p) => p.id === "pixel_9");
    expect(pixel9).toBeDefined();
    expect(pixel9?.name).toBe("Pixel 9");
    expect(pixel9?.oem).toBe("Google");
  });

  it("extracts profiles with spaces and special characters in id", () => {
    const profiles = parseDeviceProfiles(fixture);
    const galaxyNexus = profiles.find((p) => p.id === "Galaxy Nexus");
    expect(galaxyNexus).toBeDefined();
    expect(galaxyNexus?.name).toBe("Galaxy Nexus");
  });

  it("extracts Generic OEM profiles", () => {
    const profiles = parseDeviceProfiles(fixture);
    const mediumPhone = profiles.find((p) => p.id === "medium_phone");
    expect(mediumPhone).toBeDefined();
    expect(mediumPhone?.oem).toBe("Generic");
  });

  it("handles empty output", () => {
    expect(parseDeviceProfiles("")).toEqual([]);
  });

  it("does not produce duplicate profile ids", () => {
    const profiles = parseDeviceProfiles(fixture);
    const ids = profiles.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});
