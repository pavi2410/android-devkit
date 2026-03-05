import { describe, it, expect } from "vitest";
import { parseAvdConfig } from "../src/index.js";

const fixture = `AvdId=Medium_Phone
PlayStore.enabled=true
abi.type=arm64-v8a
avd.ini.displayname=Medium Phone
avd.ini.encoding=UTF-8
disk.dataPartition.size=6G
hw.accelerometer=yes
hw.cpu.arch=arm64
hw.cpu.ncore=4
hw.device.manufacturer=Generic
hw.device.name=medium_phone
hw.gps=yes
hw.gpu.enabled=yes
hw.gpu.mode=auto
hw.lcd.density=420
hw.lcd.height=2400
hw.lcd.width=1080
hw.ramSize=2048
image.sysdir.1=system-images/android-36.1/google_apis_playstore/arm64-v8a/
sdcard.size=512M
skin.name=medium_phone
tag.display=Google Play
tag.id=google_apis_playstore
target=android-36.1
vm.heapSize=228`;

describe("parseAvdConfig", () => {
  it("parses without throwing", () => {
    expect(() => parseAvdConfig(fixture)).not.toThrow();
  });

  it("extracts display name", () => {
    const config = parseAvdConfig(fixture);
    expect(config.displayName).toBe("Medium Phone");
  });

  it("extracts RAM size", () => {
    const config = parseAvdConfig(fixture);
    expect(config.ram).toBe(2048);
  });

  it("extracts LCD dimensions", () => {
    const config = parseAvdConfig(fixture);
    expect(config.lcdWidth).toBe(1080);
    expect(config.lcdHeight).toBe(2400);
    expect(config.lcdDensity).toBe(420);
  });

  it("extracts CPU info", () => {
    const config = parseAvdConfig(fixture);
    expect(config.cpuArch).toBe("arm64");
    expect(config.cpuCores).toBe(4);
  });

  it("extracts GPU settings", () => {
    const config = parseAvdConfig(fixture);
    expect(config.gpuEnabled).toBe(true);
    expect(config.gpuMode).toBe("auto");
  });

  it("extracts Play Store enabled", () => {
    const config = parseAvdConfig(fixture);
    expect(config.playStoreEnabled).toBe(true);
  });

  it("extracts image sysdir and target", () => {
    const config = parseAvdConfig(fixture);
    expect(config.imageSysdir).toBe("system-images/android-36.1/google_apis_playstore/arm64-v8a/");
    expect(config.targetApi).toBe("android-36.1");
  });

  it("extracts sdcard size", () => {
    const config = parseAvdConfig(fixture);
    expect(config.sdcard).toBe("512M");
  });

  it("extracts skin name", () => {
    const config = parseAvdConfig(fixture);
    expect(config.skin).toBe("medium_phone");
  });

  it("handles empty input", () => {
    const config = parseAvdConfig("");
    expect(config.displayName).toBeUndefined();
    expect(config.ram).toBeUndefined();
  });
});
