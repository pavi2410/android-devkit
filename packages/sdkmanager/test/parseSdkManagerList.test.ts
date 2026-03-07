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

  it("parses available updates with installedVersion and availableVersion", () => {
    const packages = parseSdkManagerList(fixture);

    // The fixture's Available Updates section has:
    //   cmdline-tools;latest | 19.0    | 20.0
    //   emulator             | 36.3.10 | 36.4.9
    //   platform-tools       | 36.0.2  | 37.0.0
    const cmdlineTools = packages.find((p) => p.id === "cmdline-tools;latest");
    expect(cmdlineTools).toBeDefined();
    expect(cmdlineTools!.installedVersion).toBe("19.0");
    expect(cmdlineTools!.availableVersion).toBe("20.0");

    const emulator = packages.find((p) => p.id === "emulator");
    expect(emulator).toBeDefined();
    expect(emulator!.installedVersion).toBe("36.3.10");
    expect(emulator!.availableVersion).toBe("36.4.9");

    const platformTools = packages.find((p) => p.id === "platform-tools");
    expect(platformTools).toBeDefined();
    expect(platformTools!.installedVersion).toBe("36.0.2");
    expect(platformTools!.availableVersion).toBe("37.0.0");
  });

  it("packages without updates have no installedVersion/availableVersion", () => {
    const packages = parseSdkManagerList(fixture);
    const platform36 = packages.find((p) => p.id === "platforms;android-36");
    expect(platform36).toBeDefined();
    expect(platform36!.installedVersion).toBeUndefined();
    expect(platform36!.availableVersion).toBeUndefined();
  });

  it("marks obsolete packages", () => {
    const packages = parseSdkManagerList(fixture);

    // These appear in the "Available Obsolete Packages" section
    const obsoleteIds = [
      "build-tools;17.0.0",
      "build-tools;18.0.1",
      "platforms;android-2",
      "platforms;android-3",
      "tools",
    ];
    for (const id of obsoleteIds) {
      const pkg = packages.find((p) => p.id === id);
      expect(pkg, `obsolete package "${id}" should be present`).toBeDefined();
      expect(pkg!.obsolete, `package "${id}" should be marked obsolete`).toBe(true);
    }
  });

  it("non-obsolete packages are not marked obsolete", () => {
    const packages = parseSdkManagerList(fixture);
    const platform36 = packages.find((p) => p.id === "platforms;android-36");
    expect(platform36).toBeDefined();
    expect(platform36!.obsolete).toBeUndefined();
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
