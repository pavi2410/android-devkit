import { describe, expect, it, vi, beforeEach } from "vitest";
import { commands } from "vscode";
import { setAndroidDevkitContext } from "../../src/config/context";
import { CONTEXT_KEYS, VS_CODE_COMMANDS } from "../../src/commands/ids";

describe("config/context", () => {
  beforeEach(() => {
    vi.mocked(commands.executeCommand).mockClear();
  });

  it("setAndroidDevkitContext calls executeCommand with setContext", async () => {
    await setAndroidDevkitContext(CONTEXT_KEYS.hasDevices, true);

    expect(commands.executeCommand).toHaveBeenCalledWith(
      VS_CODE_COMMANDS.setContext,
      "androidDevkit.hasDevices",
      true
    );
  });

  it("passes boolean values correctly", async () => {
    await setAndroidDevkitContext(CONTEXT_KEYS.logcatRunning, false);

    expect(commands.executeCommand).toHaveBeenCalledWith(
      VS_CODE_COMMANDS.setContext,
      "androidDevkit.logcatRunning",
      false
    );
  });

  it("passes string values correctly", async () => {
    await setAndroidDevkitContext(CONTEXT_KEYS.sdkConfigured, true);

    expect(commands.executeCommand).toHaveBeenCalledWith(
      VS_CODE_COMMANDS.setContext,
      "androidDevkit.sdkConfigured",
      true
    );
  });
});
