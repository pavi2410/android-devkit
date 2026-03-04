import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { parseSdkManagerList } from "../src/index.js";

const fixture = readFileSync(
  join(import.meta.dirname, "fixtures/sdkmanager__list_include_obsolete.txt"),
  "utf-8"
);

describe("parseSdkManagerList", () => {
  it("parses without throwing", () => {
    expect(() => parseSdkManagerList(fixture)).not.toThrow();
  });

  it("returns a non-empty list", () => {
    const packages = parseSdkManagerList(fixture);
    expect(packages.length).toBeGreaterThan(0);
  });

  it("marks installed packages correctly", () => {
    const packages = parseSdkManagerList(fixture);

    // These IDs appear in the Installed section of the fixture
    const installedIds = [
      "build-tools;33.0.1",
      "build-tools;34.0.0",
      "build-tools;35.0.0",
      "build-tools;36.0.0",
      "build-tools;36.1.0",
      "cmdline-tools;latest",
      "emulator",
      "platform-tools",
      "platforms;android-34",
      "platforms;android-36",
      "platforms;android-36.1",
      "sources;android-36",
      "sources;android-36.1",
      "system-images;android-36.1;google_apis_playstore;arm64-v8a",
      "system-images;android-36;google_apis;arm64-v8a",
    ];

    for (const id of installedIds) {
      const pkg = packages.find((p) => p.id === id);
      expect(pkg, `package "${id}" should be present`).toBeDefined();
      expect(pkg!.installed, `package "${id}" should be marked installed`).toBe(true);
    }
  });

  it("does not mark non-installed packages as installed", () => {
    const packages = parseSdkManagerList(fixture);

    // These IDs appear only in the Available section
    const notInstalledIds = [
      "build-tools;19.1.0",
      "build-tools;33.0.2",
      "build-tools;35.0.1",
      "cmake;3.22.1",
      "ndk;28.2.13676358",
      "platforms;android-10",
      "platforms;android-33",
    ];

    for (const id of notInstalledIds) {
      const pkg = packages.find((p) => p.id === id);
      expect(pkg, `package "${id}" should be present`).toBeDefined();
      expect(pkg!.installed, `package "${id}" should NOT be marked installed`).toBe(false);
    }
  });

  it("does not produce duplicate package ids", () => {
    const packages = parseSdkManagerList(fixture);
    const ids = packages.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("installed count is less than total count (not all installed)", () => {
    const packages = parseSdkManagerList(fixture);
    const installedCount = packages.filter((p) => p.installed).length;
    const totalCount = packages.length;
    expect(installedCount).toBeLessThan(totalCount);
    // Fixture has 15 installed packages
    expect(installedCount).toBe(15);
  });

  it("assigns categories to packages", () => {
    const packages = parseSdkManagerList(fixture);
    const buildTools = packages.find((p) => p.id === "build-tools;33.0.1");
    expect(buildTools?.category).toBe("build-tools");

    const platform = packages.find((p) => p.id === "platforms;android-34");
    expect(platform?.category).toBe("platforms");

    const emulator = packages.find((p) => p.id === "emulator");
    expect(emulator?.category).toBe("emulator");
  });
});
