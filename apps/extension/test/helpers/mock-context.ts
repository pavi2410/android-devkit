import { vi } from "vitest";

interface MockMemento {
  get<T>(key: string, defaultValue?: T): T | undefined;
  update(key: string, value: unknown): Promise<void>;
  keys(): readonly string[];
}

function createMockMemento(): MockMemento {
  const store = new Map<string, unknown>();
  return {
    get<T>(key: string, defaultValue?: T): T | undefined {
      return store.has(key) ? (store.get(key) as T) : defaultValue;
    },
    update: vi.fn(async (key: string, value: unknown) => {
      if (value === undefined) {
        store.delete(key);
      } else {
        store.set(key, value);
      }
    }),
    keys(): readonly string[] {
      return [...store.keys()];
    },
  };
}

export function createMockExtensionContext() {
  const subscriptions: { dispose: () => void }[] = [];

  return {
    subscriptions,
    globalState: createMockMemento(),
    workspaceState: createMockMemento(),
    extensionPath: "/mock/extension/path",
    extensionUri: { fsPath: "/mock/extension/path" },
    storagePath: "/mock/storage",
    globalStoragePath: "/mock/global-storage",
    logPath: "/mock/log",
    extensionMode: 3,
    asAbsolutePath: (relativePath: string) => `/mock/extension/path/${relativePath}`,
  };
}
