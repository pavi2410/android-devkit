import { vi } from "vitest";

// --- EventEmitter ---

export class EventEmitter<T = void> {
  private listeners: Array<(e: T) => void> = [];
  private _disposed = false;

  event = (listener: (e: T) => void): { dispose: () => void } => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const idx = this.listeners.indexOf(listener);
        if (idx >= 0) this.listeners.splice(idx, 1);
      },
    };
  };

  fire(data: T): void {
    if (this._disposed) return;
    for (const listener of [...this.listeners]) {
      listener(data);
    }
  }

  dispose(): void {
    this._disposed = true;
    this.listeners = [];
  }
}

// --- Enums ---

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

// --- Classes ---

export class TreeItem {
  label?: string;
  id?: string;
  description?: string;
  tooltip?: string | MarkdownString;
  iconPath?: ThemeIcon;
  collapsibleState?: TreeItemCollapsibleState;
  command?: { command: string; title: string; arguments?: unknown[] };
  contextValue?: string;

  constructor(
    labelOrUri: string | Uri,
    collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None
  ) {
    if (typeof labelOrUri === "string") {
      this.label = labelOrUri;
    }
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  static readonly File = new ThemeIcon("file");
  static readonly Folder = new ThemeIcon("folder");

  constructor(public readonly id: string) {}
}

export class Uri {
  readonly scheme: string;
  readonly fsPath: string;
  readonly path: string;

  private constructor(scheme: string, path: string) {
    this.scheme = scheme;
    this.path = path;
    this.fsPath = path;
  }

  static file(path: string): Uri {
    return new Uri("file", path);
  }

  static parse(value: string): Uri {
    return new Uri("https", value);
  }

  toString(): string {
    return `${this.scheme}://${this.path}`;
  }
}

export class MarkdownString {
  value: string;

  constructor(value?: string) {
    this.value = value ?? "";
  }

  appendMarkdown(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendText(value: string): MarkdownString {
    this.value += value;
    return this;
  }
}

export class Disposable {
  constructor(private callOnDispose: () => void) {}

  static from(...disposables: { dispose: () => void }[]): Disposable {
    return new Disposable(() => {
      for (const d of disposables) d.dispose();
    });
  }

  dispose(): void {
    this.callOnDispose();
  }
}

// --- window ---

export const window = {
  showInformationMessage: vi.fn().mockResolvedValue(undefined),
  showWarningMessage: vi.fn().mockResolvedValue(undefined),
  showErrorMessage: vi.fn().mockResolvedValue(undefined),
  showInputBox: vi.fn().mockResolvedValue(undefined),
  showQuickPick: vi.fn().mockResolvedValue(undefined),
  showOpenDialog: vi.fn().mockResolvedValue(undefined),
  showSaveDialog: vi.fn().mockResolvedValue(undefined),
  withProgress: vi.fn().mockImplementation((_opts: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
    return task({ report: vi.fn() }, { isCancellationRequested: false, onCancellationRequested: vi.fn() });
  }),
  createOutputChannel: vi.fn().mockReturnValue({
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    name: "mock-output",
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  createTerminal: vi.fn().mockReturnValue({
    show: vi.fn(),
    sendText: vi.fn(),
    dispose: vi.fn(),
  }),
  createStatusBarItem: vi.fn().mockReturnValue({
    text: "",
    tooltip: "",
    command: "",
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  }),
  registerTreeDataProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
};

// --- commands ---

export const commands = {
  registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  executeCommand: vi.fn().mockResolvedValue(undefined),
};

// --- workspace ---

const mockConfig: Record<string, unknown> = {};

export const workspace = {
  getConfiguration: vi.fn().mockReturnValue({
    get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
      return key in mockConfig ? mockConfig[key] : defaultValue;
    }),
    update: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockReturnValue(false),
    inspect: vi.fn().mockReturnValue(undefined),
  }),
  workspaceFolders: undefined as { uri: Uri; name: string; index: number }[] | undefined,
  createFileSystemWatcher: vi.fn().mockReturnValue({
    onDidCreate: vi.fn(),
    onDidChange: vi.fn(),
    onDidDelete: vi.fn(),
    dispose: vi.fn(),
  }),
  fs: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(new Uint8Array()),
  },
};

/**
 * Helper to set mock configuration values for tests.
 */
export function __setMockConfig(key: string, value: unknown): void {
  mockConfig[key] = value;
}

export function __clearMockConfig(): void {
  for (const key of Object.keys(mockConfig)) {
    delete mockConfig[key];
  }
}
