import { describe, expect, it, vi, beforeEach } from "vitest";
import { workspace } from "vscode";
import {
  getConfiguredSdkPath,
  getLogcatDefaultLogLevel,
  getLogcatMaxLines,
  ANDROID_DEVKIT_SETTINGS,
} from "../../src/config/settings";

describe("config/settings", () => {
  beforeEach(() => {
    vi.mocked(workspace.getConfiguration).mockClear();
  });

  it("getConfiguredSdkPath returns configured value", () => {
    const mockGet = vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === ANDROID_DEVKIT_SETTINGS.sdkPath) return "/custom/sdk";
      return defaultValue;
    });
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    } as any);

    expect(getConfiguredSdkPath()).toBe("/custom/sdk");
    expect(workspace.getConfiguration).toHaveBeenCalledWith("androidDevkit");
  });

  it("getConfiguredSdkPath returns empty string as default", () => {
    const mockGet = vi.fn().mockImplementation((_key: string, defaultValue?: unknown) => defaultValue);
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    } as any);

    expect(getConfiguredSdkPath()).toBe("");
  });

  it("getLogcatDefaultLogLevel returns configured value", () => {
    const mockGet = vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === ANDROID_DEVKIT_SETTINGS.logcatDefaultLogLevel) return "W";
      return defaultValue;
    });
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    } as any);

    expect(getLogcatDefaultLogLevel()).toBe("W");
  });

  it("getLogcatDefaultLogLevel returns I as default", () => {
    const mockGet = vi.fn().mockImplementation((_key: string, defaultValue?: unknown) => defaultValue);
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    } as any);

    expect(getLogcatDefaultLogLevel()).toBe("I");
  });

  it("getLogcatMaxLines returns configured value", () => {
    const mockGet = vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === ANDROID_DEVKIT_SETTINGS.logcatMaxLines) return 5000;
      return defaultValue;
    });
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    } as any);

    expect(getLogcatMaxLines()).toBe(5000);
  });

  it("getLogcatMaxLines returns 10000 as default", () => {
    const mockGet = vi.fn().mockImplementation((_key: string, defaultValue?: unknown) => defaultValue);
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    } as any);

    expect(getLogcatMaxLines()).toBe(10000);
  });
});
