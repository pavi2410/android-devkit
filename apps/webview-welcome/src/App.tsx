import { useState, useEffect } from "react";
import type { MessageToWebview, MessageToHost } from "./types";

declare const acquireVsCodeApi: () => {
  postMessage: (msg: MessageToHost) => void;
};

const vscode = typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

function postMessage(msg: MessageToHost) {
  vscode?.postMessage(msg);
}

// ── Icons (inline SVG, thin-stroke style matching VS Code codicons feel) ──────

function AndroidIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.18 15.64a2.18 2.18 0 0 1-2.18-2.18V9.68a2.18 2.18 0 1 1 4.36 0v3.78a2.18 2.18 0 0 1-2.18 2.18m11.64 0a2.18 2.18 0 0 1-2.18-2.18V9.68a2.18 2.18 0 1 1 4.36 0v3.78a2.18 2.18 0 0 1-2.18 2.18M15.88 3.2l1.64-2.84a.34.34 0 1 0-.59-.34l-1.66 2.88A10.14 10.14 0 0 0 12 2.4c-1.16 0-2.27.21-3.27.5L7.07.02a.34.34 0 1 0-.59.34L8.12 3.2A9.81 9.81 0 0 0 3.64 9h16.72a9.81 9.81 0 0 0-4.48-5.8M9.5 6.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5m5 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5M4 10v8a2 2 0 0 0 2 2h1v3a1.5 1.5 0 0 0 3 0v-3h4v3a1.5 1.5 0 0 0 3 0v-3h1a2 2 0 0 0 2-2v-8H4z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.763.646z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.72L8 2.28zM8.625 12v-1h-1.25v1h1.25zm-1.25-2V6h1.25v4h-1.25z" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M14.5 3H7.71l-.85-.85L6.51 2h-5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.5 8.5v1h-12v-9h4.29l.85.85.35.15H14v7z" />
    </svg>
  );
}

function DeviceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M11 1H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm1 12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v10zM8 12a.75.75 0 1 0 0-1.5A.75.75 0 0 0 8 12z" />
    </svg>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 2L1 3v10l1 1h12l1-1V3l-1-1H2zm12 11H2V3h12v10zM3 4l4 4-4 4-.7-.7L5.6 8 2.3 4.7 3 4zm4 7h5v1H7v-1z" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm4.662 4h-2.552a8.4 8.4 0 0 0-1.141-2.527A6.01 6.01 0 0 1 12.662 5zM8 2.033c.68.742 1.356 1.78 1.726 2.967H6.274C6.644 3.813 7.32 2.775 8 2.033zM2.057 9a6.07 6.07 0 0 1 0-2h2.884a12.517 12.517 0 0 0 0 2H2.057zm.281 1h2.552c.264.988.68 1.87 1.141 2.527A6.006 6.006 0 0 1 2.338 10zm2.552-4H2.338A6.01 6.01 0 0 1 6.031 3.473 8.4 8.4 0 0 0 4.89 6zm.384 1h5.452a11.5 11.5 0 0 1 0 2H5.274a11.5 11.5 0 0 1 0-2zm.362 3h4.728C9.998 11.38 9.1 12.5 8 12.967 6.9 12.5 6.002 11.38 5.636 10zm3.333 2.527A8.4 8.4 0 0 0 10.11 10h2.552a6.006 6.006 0 0 1-3.693 2.527zm1.141-3.527a12.517 12.517 0 0 0 0-2h2.884a6.07 6.07 0 0 1 0 2h-2.884z" />
    </svg>
  );
}

function ChevronRightIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 16 16" fill="currentColor">
      <path d="M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 12.98l-.618-.62 4.357-4.336z" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppState {
  sdkPath: string | null;
  version: string;
  initialized: boolean;
}

// ── Components ────────────────────────────────────────────────────────────────

function SdkStatusCard({ sdkPath, onBrowse }: { sdkPath: string | null; onBrowse: () => void }) {
  const found = sdkPath !== null;
  return (
    <div
      className="rounded border px-4 py-3 flex items-start gap-3"
      style={{
        backgroundColor: "var(--vscode-editor-background)",
        borderColor: found
          ? "var(--vscode-terminal-ansiGreen)"
          : "var(--vscode-editorWarning-foreground)",
        borderWidth: "1px",
      }}
    >
      <div
        className="mt-0.5 shrink-0"
        style={{
          color: found
            ? "var(--vscode-terminal-ansiGreen)"
            : "var(--vscode-editorWarning-foreground)",
        }}
      >
        {found ? <CheckIcon className="w-4 h-4" /> : <WarningIcon className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--vscode-foreground)" }}>
          {found ? "Android SDK detected" : "Android SDK not found"}
        </p>
        {found ? (
          <p
            className="text-xs mt-0.5 font-mono truncate"
            style={{ color: "var(--vscode-descriptionForeground)" }}
          >
            {sdkPath}
          </p>
        ) : (
          <p className="text-xs mt-0.5" style={{ color: "var(--vscode-descriptionForeground)" }}>
            Set <code className="font-mono">ANDROID_HOME</code> or select the SDK folder below.
          </p>
        )}
      </div>
      {!found && (
        <button
          onClick={onBrowse}
          className="shrink-0 text-xs px-3 py-1 rounded cursor-pointer transition-colors"
          style={{
            backgroundColor: "var(--vscode-button-background)",
            color: "var(--vscode-button-foreground)",
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLElement).style.backgroundColor =
              "var(--vscode-button-hoverBackground)")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLElement).style.backgroundColor = "var(--vscode-button-background)")
          }
        >
          Browse…
        </button>
      )}
      {found && (
        <button
          onClick={onBrowse}
          className="shrink-0 text-xs px-3 py-1 rounded cursor-pointer transition-colors"
          style={{
            backgroundColor: "var(--vscode-button-secondaryBackground)",
            color: "var(--vscode-button-secondaryForeground)",
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLElement).style.backgroundColor =
              "var(--vscode-button-secondaryHoverBackground)")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLElement).style.backgroundColor =
              "var(--vscode-button-secondaryBackground)")
          }
        >
          Change
        </button>
      )}
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        backgroundColor: hovered && !disabled
          ? "var(--vscode-list-hoverBackground)"
          : "var(--vscode-sideBar-background, var(--vscode-editor-background))",
        borderColor: "var(--vscode-panel-border)",
        color: "var(--vscode-foreground)",
      }}
    >
      <div
        className="shrink-0 p-2 rounded"
        style={{
          backgroundColor: "var(--vscode-badge-background)",
          color: "var(--vscode-badge-foreground)",
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--vscode-descriptionForeground)" }}>
          {description}
        </p>
      </div>
      <ChevronRightIcon
        className="w-4 h-4 shrink-0"
        style={{ color: "var(--vscode-descriptionForeground)" } as React.CSSProperties}
      />
    </button>
  );
}

function LinkRow({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description?: string;
}) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        postMessage({ type: "openExternal", url: href });
      }}
      className="flex items-center gap-2 py-1 text-sm group"
      style={{ color: "var(--vscode-textLink-foreground)" }}
    >
      <ChevronRightIcon className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100" />
      <span className="font-medium">{label}</span>
      {description && (
        <span style={{ color: "var(--vscode-descriptionForeground)" }}>— {description}</span>
      )}
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2
        className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--vscode-descriptionForeground)" }}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export function App() {
  const [state, setState] = useState<AppState>({
    sdkPath: null,
    version: "0.1.0",
    initialized: false,
  });

  useEffect(() => {
    const handler = (event: MessageEvent<MessageToWebview>) => {
      const msg = event.data;
      if (msg.type === "init") {
        setState({ sdkPath: msg.sdkPath, version: msg.version, initialized: true });
      } else if (msg.type === "sdkPathUpdated") {
        setState((s) => ({ ...s, sdkPath: msg.path }));
      }
    };

    window.addEventListener("message", handler);

    // Signal ready to host — request init data
    postMessage({ type: "openView", viewId: "__ready__" });

    return () => window.removeEventListener("message", handler);
  }, []);

  const sdkFound = state.sdkPath !== null;

  const handleBrowse = () => postMessage({ type: "selectSdkPath" });
  const openView = (viewId: string) => postMessage({ type: "openView", viewId });

  if (!state.initialized) {
    return (
      <div
        className="flex items-center justify-center h-screen text-sm"
        style={{ color: "var(--vscode-descriptionForeground)" }}
      >
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: "var(--vscode-badge-background)" }}
        >
          <AndroidIcon
            className="w-8 h-8"
            style={{ color: "var(--vscode-badge-foreground)" } as React.CSSProperties}
          />
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--vscode-foreground)" }}>
            Android DevKit
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--vscode-descriptionForeground)" }}>
            v{state.version} · Android development tools for VS Code
          </p>
        </div>
      </div>

      {/* SDK Status */}
      <Section title="Setup">
        <SdkStatusCard sdkPath={state.sdkPath} onBrowse={handleBrowse} />
        {!sdkFound && (
          <div
            className="text-xs px-4 py-3 rounded border"
            style={{
              color: "var(--vscode-descriptionForeground)",
              borderColor: "var(--vscode-panel-border)",
              backgroundColor:
                "var(--vscode-sideBar-background, var(--vscode-editor-background))",
            }}
          >
            <p className="font-medium mb-1" style={{ color: "var(--vscode-foreground)" }}>
              How to install the Android SDK
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Download{" "}
                <a
                  href="https://developer.android.com/studio"
                  onClick={(e) => {
                    e.preventDefault();
                    postMessage({ type: "openExternal", url: "https://developer.android.com/studio" });
                  }}
                  style={{ color: "var(--vscode-textLink-foreground)" }}
                >
                  Android Studio
                </a>{" "}
                (includes SDK) or the{" "}
                <a
                  href="https://developer.android.com/tools"
                  onClick={(e) => {
                    e.preventDefault();
                    postMessage({ type: "openExternal", url: "https://developer.android.com/tools" });
                  }}
                  style={{ color: "var(--vscode-textLink-foreground)" }}
                >
                  command-line tools
                </a>
              </li>
              <li>
                Set <code className="font-mono">ANDROID_HOME</code> to your SDK path, or use the
                Browse button above
              </li>
              <li>Reload VS Code — Android DevKit will auto-detect the SDK</li>
            </ol>
          </div>
        )}
      </Section>

      {/* Quick Actions */}
      <Section title="Open">
        <ActionCard
          icon={<DeviceIcon className="w-4 h-4" />}
          title="Device Manager"
          description="View and manage connected devices and emulators"
          onClick={() => openView("androidDevkit.devices")}
        />
        <ActionCard
          icon={<GlobeIcon className="w-4 h-4" />}
          title="SDK Manager"
          description="Install and update Android SDK platforms, build tools, and system images"
          onClick={() => openView("androidDevkit.sdkManager")}
          disabled={!sdkFound}
        />
        <ActionCard
          icon={<TerminalIcon className="w-4 h-4" />}
          title="AVD Manager"
          description="Create, launch, and manage Android Virtual Devices"
          onClick={() => openView("androidDevkit.avdManager")}
          disabled={!sdkFound}
        />
        <ActionCard
          icon={<FolderIcon className="w-4 h-4" />}
          title="Device File Explorer"
          description="Browse, upload, and download files on connected devices"
          onClick={() => openView("androidDevkit.fileExplorer")}
        />
      </Section>

      {/* Links */}
      <Section title="Resources">
        <LinkRow
          href="https://github.com/pavi2410/android-devkit"
          label="GitHub"
          description="source code and issues"
        />
        <LinkRow
          href="https://github.com/pavi2410/android-devkit/blob/main/CHANGELOG.md"
          label="Changelog"
          description="what's new"
        />
        <LinkRow
          href="https://github.com/pavi2410/android-devkit/blob/main/ROADMAP.md"
          label="Roadmap"
          description="planned features"
        />
        <LinkRow
          href="https://developer.android.com/tools/adb"
          label="ADB Documentation"
        />
      </Section>
    </div>
  );
}
