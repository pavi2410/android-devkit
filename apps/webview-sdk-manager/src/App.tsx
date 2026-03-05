import { useState, useEffect, useMemo } from "react";
import type { MessageToWebview, MessageToHost, SdkPackage, SdkPackageCategory } from "./types";

declare const acquireVsCodeApi: () => {
  postMessage: (msg: MessageToHost) => void;
};

const vscode = typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

function postMessage(msg: MessageToHost) {
  vscode?.postMessage(msg);
}

const CATEGORY_LABELS: Record<SdkPackageCategory, string> = {
  platforms: "Platforms",
  "build-tools": "Build Tools",
  "platform-tools": "Platform Tools",
  "cmdline-tools": "Command-line Tools",
  "system-images": "System Images",
  extras: "Extras",
  emulator: "Emulator",
  ndk: "NDK",
  sources: "Sources",
  cmake: "CMake",
  other: "Other",
};

const ALL_CATEGORIES: SdkPackageCategory[] = [
  "platforms",
  "build-tools",
  "platform-tools",
  "cmdline-tools",
  "system-images",
  "sources",
  "emulator",
  "ndk",
  "cmake",
  "extras",
  "other",
];

type FilterMode = "all" | "installed" | "available";

interface AppState {
  packages: SdkPackage[];
  loading: boolean;
  search: string;
  filterMode: FilterMode;
  activeCategory: SdkPackageCategory | null;
  busyIds: Set<string>;
  updatingAll: boolean;
}

export function App() {
  const [state, setState] = useState<AppState>({
    packages: [],
    loading: true,
    search: "",
    filterMode: "all",
    activeCategory: null,
    busyIds: new Set(),
    updatingAll: false,
  });

  useEffect(() => {
    const handler = (event: MessageEvent<MessageToWebview>) => {
      const msg = event.data;
      switch (msg.type) {
        case "packages":
          setState((s) => ({ ...s, packages: msg.packages, loading: msg.loading }));
          break;
        case "installing":
          setState((s) => ({ ...s, busyIds: new Set(s.busyIds).add(msg.id) }));
          break;
        case "installed": {
          setState((s) => {
            const busyIds = new Set(s.busyIds);
            busyIds.delete(msg.id);
            const packages = msg.success
              ? s.packages.map((p) => (p.id === msg.id ? { ...p, installed: true } : p))
              : s.packages;
            return { ...s, busyIds, packages };
          });
          break;
        }
        case "uninstalling":
          setState((s) => ({ ...s, busyIds: new Set(s.busyIds).add(msg.id) }));
          break;
        case "uninstalled": {
          setState((s) => {
            const busyIds = new Set(s.busyIds);
            busyIds.delete(msg.id);
            const packages = msg.success
              ? s.packages.map((p) => (p.id === msg.id ? { ...p, installed: false } : p))
              : s.packages;
            return { ...s, busyIds, packages };
          });
          break;
        }
        case "updatingAll":
          setState((s) => ({ ...s, updatingAll: true }));
          break;
        case "updatedAll":
          setState((s) => ({ ...s, updatingAll: false }));
          break;
      }
    };

    window.addEventListener("message", handler);
    postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  const categories = useMemo(() => {
    const used = new Set(state.packages.map((p) => p.category));
    return ALL_CATEGORIES.filter((c) => used.has(c));
  }, [state.packages]);

  const filtered = useMemo(() => {
    let pkgs = state.packages;

    if (state.activeCategory) {
      pkgs = pkgs.filter((p) => p.category === state.activeCategory);
    }

    if (state.filterMode === "installed") {
      pkgs = pkgs.filter((p) => p.installed);
    } else if (state.filterMode === "available") {
      pkgs = pkgs.filter((p) => !p.installed);
    }

    if (state.search) {
      const q = state.search.toLowerCase();
      pkgs = pkgs.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }

    return pkgs;
  }, [state.packages, state.activeCategory, state.filterMode, state.search]);

  const installedCount = state.packages.filter((p) => p.installed).length;

  if (state.loading && state.packages.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-screen gap-2 text-sm"
        style={{ color: "var(--vscode-descriptionForeground)" }}
      >
        <Spinner />
        Loading SDK packages…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div
        className="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-4 py-3 border-b"
        style={{
          backgroundColor: "var(--vscode-editor-background)",
          borderColor: "var(--vscode-panel-border)",
        }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <input
            type="text"
            placeholder="Search packages…"
            value={state.search}
            onChange={(e) => setState((s) => ({ ...s, search: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm rounded outline-none"
            style={{
              backgroundColor: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              border: "1px solid var(--vscode-input-border, transparent)",
            }}
          />
          {state.search && (
            <button
              onClick={() => setState((s) => ({ ...s, search: "" }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs cursor-pointer opacity-60 hover:opacity-100"
              style={{ color: "var(--vscode-input-foreground)" }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter mode */}
        <ToggleGroup
          options={[
            { value: "all", label: `All (${state.packages.length})` },
            { value: "installed", label: `Installed (${installedCount})` },
            { value: "available", label: `Available (${state.packages.length - installedCount})` },
          ]}
          value={state.filterMode}
          onChange={(v) => setState((s) => ({ ...s, filterMode: v as FilterMode }))}
        />

        {/* Actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          <ActionButton
            label="Refresh"
            icon="↻"
            onClick={() => postMessage({ type: "refresh" })}
            disabled={state.loading}
          />
          <ActionButton
            label="Update All"
            icon="⬆"
            onClick={() => postMessage({ type: "updateAll" })}
            disabled={state.updatingAll || state.loading}
            busy={state.updatingAll}
          />
        </div>
      </div>

      {/* Category tabs */}
      <div
        className="flex items-center gap-1 px-4 py-2 overflow-x-auto border-b"
        style={{ borderColor: "var(--vscode-panel-border)" }}
      >
        <CategoryChip
          label="All"
          active={state.activeCategory === null}
          onClick={() => setState((s) => ({ ...s, activeCategory: null }))}
        />
        {categories.map((cat) => (
          <CategoryChip
            key={cat}
            label={CATEGORY_LABELS[cat]}
            active={state.activeCategory === cat}
            onClick={() => setState((s) => ({ ...s, activeCategory: cat }))}
            count={state.packages.filter((p) => p.category === cat).length}
          />
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div
            className="flex items-center justify-center h-32 text-sm"
            style={{ color: "var(--vscode-descriptionForeground)" }}
          >
            No packages match your filters
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-xs uppercase tracking-wider sticky top-0"
                style={{
                  backgroundColor: "var(--vscode-editor-background)",
                  color: "var(--vscode-descriptionForeground)",
                }}
              >
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium w-28">Version</th>
                <th className="px-4 py-2 font-medium w-28">Status</th>
                <th className="px-4 py-2 font-medium w-40">Category</th>
                <th className="px-4 py-2 font-medium w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pkg) => (
                <PackageRow
                  key={pkg.id}
                  pkg={pkg}
                  busy={state.busyIds.has(pkg.id)}
                  onInstall={() => postMessage({ type: "install", id: pkg.id })}
                  onUninstall={() => postMessage({ type: "uninstall", id: pkg.id })}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-4 py-1.5 text-xs border-t"
        style={{
          backgroundColor: "var(--vscode-sideBar-background, var(--vscode-editor-background))",
          borderColor: "var(--vscode-panel-border)",
          color: "var(--vscode-descriptionForeground)",
        }}
      >
        <span>
          {filtered.length} package{filtered.length !== 1 ? "s" : ""} shown
          {state.search || state.filterMode !== "all" || state.activeCategory
            ? ` (filtered from ${state.packages.length})`
            : ""}
        </span>
        <span>{installedCount} installed</span>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────────── */

function PackageRow({
  pkg,
  busy,
  onInstall,
  onUninstall,
}: {
  pkg: SdkPackage;
  busy: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="border-b transition-colors"
      style={{
        borderColor: "var(--vscode-panel-border)",
        backgroundColor: hovered
          ? "var(--vscode-list-hoverBackground)"
          : "transparent",
      }}
    >
      <td className="px-4 py-2">
        <div className="font-medium" style={{ color: "var(--vscode-foreground)" }}>
          {pkg.displayName}
        </div>
        <div
          className="text-xs font-mono mt-0.5 truncate max-w-md"
          style={{ color: "var(--vscode-descriptionForeground)" }}
        >
          {pkg.id}
        </div>
      </td>
      <td className="px-4 py-2 font-mono" style={{ color: "var(--vscode-descriptionForeground)" }}>
        {pkg.version}
      </td>
      <td className="px-4 py-2">
        <StatusBadge installed={pkg.installed} />
      </td>
      <td className="px-4 py-2" style={{ color: "var(--vscode-descriptionForeground)" }}>
        {CATEGORY_LABELS[pkg.category] ?? pkg.category}
      </td>
      <td className="px-4 py-2 text-right">
        {busy ? (
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--vscode-descriptionForeground)" }}>
            <Spinner /> Working…
          </span>
        ) : pkg.installed ? (
          <ActionButton label="Uninstall" icon="🗑" onClick={onUninstall} variant="danger" />
        ) : (
          <ActionButton label="Install" icon="↓" onClick={onInstall} />
        )}
      </td>
    </tr>
  );
}

function StatusBadge({ installed }: { installed: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: installed
          ? "color-mix(in srgb, var(--vscode-terminal-ansiGreen) 15%, transparent)"
          : "color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent)",
        color: installed
          ? "var(--vscode-terminal-ansiGreen)"
          : "var(--vscode-descriptionForeground)",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{
        backgroundColor: installed
          ? "var(--vscode-terminal-ansiGreen)"
          : "var(--vscode-descriptionForeground)",
      }} />
      {installed ? "Installed" : "Available"}
    </span>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors whitespace-nowrap"
      style={{
        backgroundColor: active
          ? "var(--vscode-button-background)"
          : "transparent",
        color: active
          ? "var(--vscode-button-foreground)"
          : "var(--vscode-descriptionForeground)",
        border: active
          ? "1px solid transparent"
          : "1px solid var(--vscode-panel-border)",
      }}
    >
      {label}
      {count !== undefined && (
        <span className="ml-1 opacity-70">{count}</span>
      )}
    </button>
  );
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex rounded overflow-hidden text-xs"
      style={{ border: "1px solid var(--vscode-panel-border)" }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-2.5 py-1 cursor-pointer transition-colors whitespace-nowrap"
          style={{
            backgroundColor:
              value === opt.value
                ? "var(--vscode-button-background)"
                : "transparent",
            color:
              value === opt.value
                ? "var(--vscode-button-foreground)"
                : "var(--vscode-descriptionForeground)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  busy,
  variant,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "danger";
}) {
  const [hovered, setHovered] = useState(false);
  const isDanger = variant === "danger";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      style={{
        backgroundColor:
          hovered && !disabled
            ? isDanger
              ? "var(--vscode-inputValidation-errorBackground, rgba(255,0,0,0.1))"
              : "var(--vscode-button-hoverBackground)"
            : isDanger
              ? "transparent"
              : "var(--vscode-button-background)",
        color: isDanger
          ? "var(--vscode-errorForeground, #f44)"
          : "var(--vscode-button-foreground)",
        border: isDanger
          ? "1px solid var(--vscode-errorForeground, #f44)"
          : "1px solid transparent",
      }}
    >
      {busy ? <Spinner /> : <span>{icon}</span>}
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block w-3 h-3 border-2 rounded-full animate-spin"
      style={{
        borderColor: "var(--vscode-descriptionForeground)",
        borderTopColor: "transparent",
      }}
    />
  );
}
