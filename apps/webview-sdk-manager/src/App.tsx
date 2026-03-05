import { useState, useEffect, useMemo, useCallback } from "react";
import type { MessageToWebview, MessageToHost, SdkPackage } from "./types";

declare const acquireVsCodeApi: () => {
  postMessage: (msg: MessageToHost) => void;
};

const vscode = typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

function postMessage(msg: MessageToHost) {
  vscode?.postMessage(msg);
}

/* ── Android version name lookup ─────────────────────────────────────────────── */

const ANDROID_VERSION_NAMES: Record<string, string> = {
  "36.1": 'Android 16.0 ("Baklava")',
  "36": 'Android 16.0 ("Baklava")',
  "35": 'Android 15.0 ("VanillaIceCream")',
  "34": 'Android 14.0 ("UpsideDownCake")',
  "33": 'Android 13.0 ("Tiramisu")',
  "32": 'Android 12L ("Snow Cone v2")',
  "31": 'Android 12.0 ("Snow Cone")',
  "30": 'Android 11.0 ("Red Velvet Cake")',
  "29": 'Android 10.0 ("Quince Tart")',
  "28": 'Android 9.0 ("Pie")',
  "27": 'Android 8.1 ("Oreo")',
  "26": 'Android 8.0 ("Oreo")',
  "25": 'Android 7.1 ("Nougat")',
  "24": 'Android 7.0 ("Nougat")',
  "23": 'Android 6.0 ("Marshmallow")',
  "22": 'Android 5.1 ("Lollipop")',
  "21": 'Android 5.0 ("Lollipop")',
  "20": 'Android 4.4W ("KitKat Wear")',
  "19": 'Android 4.4 ("KitKat")',
  "18": 'Android 4.3 ("Jelly Bean")',
  "17": 'Android 4.2 ("Jelly Bean")',
  "16": 'Android 4.1 ("Jelly Bean")',
  "15": 'Android 4.0.3 ("Ice Cream Sandwich")',
  "14": 'Android 4.0 ("Ice Cream Sandwich")',
  "13": 'Android 3.2 ("Honeycomb")',
  "12": 'Android 3.1 ("Honeycomb")',
  "11": 'Android 3.0 ("Honeycomb")',
  "10": 'Android 2.3.3 ("Gingerbread")',
  "9": 'Android 2.3 ("Gingerbread")',
  "8": 'Android 2.2 ("Froyo")',
  "7": 'Android 2.1 ("Eclair")',
  Baklava: "Android Baklava Preview",
  CinnamonBun: "Android CinnamonBun Preview",
  CANARY: "Android CANARY Preview",
  UpsideDownCake: "Android UpsideDownCake Preview",
};

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

type Tab = "platforms" | "tools";

const PLATFORM_CATEGORIES = new Set(["platforms", "system-images", "sources"]);
const TOOL_FAMILIES: Record<string, string> = {
  "build-tools": "Android SDK Build-Tools",
  ndk: "NDK (Side by side)",
  "ndk-bundle": "NDK",
  cmake: "CMake",
  "cmdline-tools": "Android SDK Command-line Tools",
  extras: "Extras",
};

function extractApiKey(id: string): string | null {
  const m = id.match(/android-([^;]+)/);
  return m ? m[1] : null;
}

function apiKeyToSortNum(key: string): number {
  const n = parseFloat(key);
  return isNaN(n) ? -1 : n;
}

function getToolFamily(id: string): string {
  if (id === "platform-tools") return "platform-tools";
  if (id === "emulator") return "emulator";
  if (id === "ndk-bundle") return "ndk-bundle";
  const prefix = id.split(";")[0];
  return prefix;
}

function getToolFamilyLabel(family: string): string {
  if (family === "platform-tools") return "Android SDK Platform-Tools";
  if (family === "emulator") return "Android Emulator";
  return TOOL_FAMILIES[family] ?? family;
}

interface PlatformGroup {
  apiKey: string;
  label: string;
  packages: SdkPackage[];
}

interface ToolGroup {
  family: string;
  label: string;
  packages: SdkPackage[];
  singleton: boolean;
}

function buildPlatformGroups(packages: SdkPackage[]): PlatformGroup[] {
  const map = new Map<string, SdkPackage[]>();
  for (const p of packages) {
    if (!PLATFORM_CATEGORIES.has(p.category)) continue;
    const key = extractApiKey(p.id) ?? "unknown";
    const arr = map.get(key) ?? [];
    arr.push(p);
    map.set(key, arr);
  }
  const groups: PlatformGroup[] = [];
  for (const [apiKey, pkgs] of map) {
    const label = ANDROID_VERSION_NAMES[apiKey] ?? `Android API ${apiKey}`;
    groups.push({ apiKey, label, packages: pkgs });
  }
  groups.sort((a, b) => {
    const na = apiKeyToSortNum(a.apiKey);
    const nb = apiKeyToSortNum(b.apiKey);
    if (na !== -1 && nb !== -1) return nb - na;
    if (na === -1 && nb === -1) return a.apiKey < b.apiKey ? 1 : -1;
    return na === -1 ? -1 : 1;
  });
  return groups;
}

function buildToolGroups(packages: SdkPackage[]): ToolGroup[] {
  const map = new Map<string, SdkPackage[]>();
  for (const p of packages) {
    if (PLATFORM_CATEGORIES.has(p.category)) continue;
    const family = getToolFamily(p.id);
    const arr = map.get(family) ?? [];
    arr.push(p);
    map.set(family, arr);
  }
  const singletonFamilies = new Set(["platform-tools", "emulator"]);
  const groups: ToolGroup[] = [];
  for (const [family, pkgs] of map) {
    groups.push({
      family,
      label: getToolFamilyLabel(family),
      packages: pkgs,
      singleton: singletonFamilies.has(family) || pkgs.length === 1,
    });
  }
  // Sort: singletons last, then alphabetical
  groups.sort((a, b) => {
    if (a.singleton !== b.singleton) return a.singleton ? 1 : -1;
    return a.label.localeCompare(b.label);
  });
  return groups;
}

function hasRealUpdate(p: SdkPackage): boolean {
  return !!p.availableVersion && p.availableVersion !== p.installedVersion;
}

function groupStatus(pkgs: SdkPackage[]): "installed" | "partial" | "not_installed" | "update" {
  const installed = pkgs.filter((p) => p.installed).length;
  const hasUpdate = pkgs.some(hasRealUpdate);
  if (installed === 0) return "not_installed";
  if (hasUpdate) return "update";
  if (installed === pkgs.length) return "installed";
  return "partial";
}

/* ── Main App ────────────────────────────────────────────────────────────────── */

interface AppState {
  packages: SdkPackage[];
  loading: boolean;
  busyIds: Set<string>;
  applying: boolean;
}

export function App() {
  const [state, setState] = useState<AppState>({
    packages: [],
    loading: true,
    busyIds: new Set(),
    applying: false,
  });
  const [tab, setTab] = useState<Tab>("platforms");
  const [showDetails, setShowDetails] = useState(false);
  const [hideObsolete, setHideObsolete] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handler = (event: MessageEvent<MessageToWebview>) => {
      const msg = event.data;
      switch (msg.type) {
        case "packages":
          setState((s) => ({ ...s, packages: msg.packages, loading: msg.loading, applying: false }));
          setChecked(new Set(msg.packages.filter((p) => p.installed).map((p) => p.id)));
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
          setState((s) => ({ ...s, applying: true }));
          break;
        case "updatedAll":
          setState((s) => ({ ...s, applying: false }));
          break;
      }
    };
    window.addEventListener("message", handler);
    postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  const filteredPackages = useMemo(() => {
    if (!hideObsolete) return state.packages;
    return state.packages.filter((p) => !p.obsolete);
  }, [state.packages, hideObsolete]);

  const platformGroups = useMemo(() => buildPlatformGroups(filteredPackages), [filteredPackages]);
  const toolGroups = useMemo(() => buildToolGroups(filteredPackages), [filteredPackages]);

  // Pending changes
  const pendingInstall = useMemo(() => {
    return state.packages.filter((p) => !p.installed && checked.has(p.id)).map((p) => p.id);
  }, [state.packages, checked]);
  const pendingUninstall = useMemo(() => {
    return state.packages.filter((p) => p.installed && !checked.has(p.id)).map((p) => p.id);
  }, [state.packages, checked]);
  const hasPendingChanges = pendingInstall.length > 0 || pendingUninstall.length > 0;

  const handleApply = useCallback(() => {
    if (!hasPendingChanges) return;
    setState((s) => ({ ...s, applying: true }));
    postMessage({ type: "applyChanges", install: pendingInstall, uninstall: pendingUninstall });
  }, [hasPendingChanges, pendingInstall, pendingUninstall]);

  const handleCancel = useCallback(() => {
    setChecked(new Set(state.packages.filter((p) => p.installed).map((p) => p.id)));
  }, [state.packages]);

  const toggleCheck = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (state.loading && state.packages.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-screen gap-2 text-sm"
        style={{ color: "var(--vscode-descriptionForeground)" }}
      >
        <Spinner /> Loading SDK packages…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ color: "var(--vscode-foreground)" }}>
      {/* Tab bar */}
      <div
        className="flex items-center border-b"
        style={{
          backgroundColor: "var(--vscode-editor-background)",
          borderColor: "var(--vscode-panel-border)",
        }}
      >
        <TabButton label="SDK Platforms" active={tab === "platforms"} onClick={() => setTab("platforms")} />
        <TabButton label="SDK Tools" active={tab === "tools"} onClick={() => setTab("tools")} />
        <div className="ml-auto flex items-center gap-2 px-3">
          <button
            onClick={() => postMessage({ type: "refresh" })}
            disabled={state.loading}
            className="text-xs px-2 py-1 rounded cursor-pointer transition-colors disabled:opacity-40"
            style={{
              color: "var(--vscode-descriptionForeground)",
            }}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Description */}
      <div
        className="px-4 py-2 text-xs border-b"
        style={{
          borderColor: "var(--vscode-panel-border)",
          color: "var(--vscode-descriptionForeground)",
        }}
      >
        {tab === "platforms"
          ? 'Each Android SDK Platform package includes the Android platform and sources pertaining to an API level by default. Once installed, the IDE will automatically check for updates. Check "show package details" to display individual SDK components.'
          : 'Below are the available SDK developer tools. Once installed, the IDE will automatically check for updates. Check "show package details" to display available versions of an SDK Tool.'}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs sticky top-0 z-10 whitespace-nowrap"
              style={{
                backgroundColor: "var(--vscode-editor-background)",
                color: "var(--vscode-descriptionForeground)",
                borderBottom: "1px solid var(--vscode-panel-border)",
              }}
            >
              <th className="w-8" />
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium w-32">{tab === "platforms" ? "API Level" : "Version"}</th>
              {tab === "platforms" && <th className="px-3 py-2 font-medium w-20">Revision</th>}
              <th className="px-3 py-2 font-medium w-44">Status</th>
            </tr>
          </thead>
          <tbody>
            {tab === "platforms"
              ? platformGroups.map((g) => (
                  <PlatformGroupRows
                    key={g.apiKey}
                    group={g}
                    showDetails={showDetails}
                    expanded={expanded.has(g.apiKey)}
                    onToggleExpand={() => toggleExpand(g.apiKey)}
                    checked={checked}
                    onToggleCheck={toggleCheck}
                    busyIds={state.busyIds}
                  />
                ))
              : toolGroups.map((g) => (
                  <ToolGroupRows
                    key={g.family}
                    group={g}
                    showDetails={showDetails}
                    expanded={expanded.has(g.family)}
                    onToggleExpand={() => toggleExpand(g.family)}
                    checked={checked}
                    onToggleCheck={toggleCheck}
                    busyIds={state.busyIds}
                  />
                ))}
          </tbody>
        </table>
      </div>

      {/* Bottom bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-t text-xs"
        style={{
          backgroundColor: "var(--vscode-sideBar-background, var(--vscode-editor-background))",
          borderColor: "var(--vscode-panel-border)",
        }}
      >
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: "var(--vscode-descriptionForeground)" }}>
            <input
              type="checkbox"
              checked={hideObsolete}
              onChange={(e) => setHideObsolete(e.target.checked)}
              className="accent-[var(--vscode-focusBorder)]"
            />
            Hide Obsolete Packages
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: "var(--vscode-descriptionForeground)" }}>
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => setShowDetails(e.target.checked)}
              className="accent-[var(--vscode-focusBorder)]"
            />
            Show Package Details
          </label>
        </div>
        <div className="flex items-center gap-2">
          {hasPendingChanges && (
            <span style={{ color: "var(--vscode-descriptionForeground)" }}>
              {pendingInstall.length > 0 && `${pendingInstall.length} to install`}
              {pendingInstall.length > 0 && pendingUninstall.length > 0 && ", "}
              {pendingUninstall.length > 0 && `${pendingUninstall.length} to uninstall`}
            </span>
          )}
          <button
            onClick={handleCancel}
            disabled={!hasPendingChanges || state.applying}
            className="px-3 py-1 rounded cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              color: "var(--vscode-button-secondaryForeground)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!hasPendingChanges || state.applying}
            className="px-3 py-1 rounded cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--vscode-button-background)",
              color: "var(--vscode-button-foreground)",
            }}
          >
            {state.applying ? <><Spinner /> Applying…</> : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Platform group rows ─────────────────────────────────────────────────────── */

function PlatformGroupRows({
  group,
  showDetails,
  expanded,
  onToggleExpand,
  checked,
  onToggleCheck,
  busyIds,
}: {
  group: PlatformGroup;
  showDetails: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  checked: Set<string>;
  onToggleCheck: (id: string) => void;
  busyIds: Set<string>;
}) {
  const status = groupStatus(group.packages);
  const installedCount = group.packages.filter((p) => p.installed).length;
  const platformPkg = group.packages.find((p) => p.category === "platforms");
  const revision = platformPkg?.version ?? "";
  const apiDisplay = group.apiKey;

  // Group-level checkbox: all checked or none
  const allChecked = group.packages.every((p) => checked.has(p.id));
  const someChecked = group.packages.some((p) => checked.has(p.id));

  const handleGroupCheck = () => {
    if (allChecked) {
      group.packages.forEach((p) => onToggleCheck(p.id));
    } else {
      group.packages.filter((p) => !checked.has(p.id)).forEach((p) => onToggleCheck(p.id));
    }
  };

  if (!showDetails) {
    return (
      <tr
        className="border-b transition-colors hover-row"
        style={{ borderColor: "var(--vscode-panel-border)" }}
      >
        <td className="pl-3 pr-1 py-1.5 text-center whitespace-nowrap">
          <Checkbox checked={allChecked} indeterminate={someChecked && !allChecked} onChange={handleGroupCheck} />
        </td>
        <td className="px-3 py-1.5 font-medium whitespace-nowrap">{group.label}</td>
        <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: "var(--vscode-descriptionForeground)" }}>{apiDisplay}</td>
        <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: "var(--vscode-descriptionForeground)" }}>{revision}</td>
        <td className="px-3 py-1.5 whitespace-nowrap">
          <StatusText status={status} installedCount={installedCount} totalCount={group.packages.length} pkg={platformPkg} />
        </td>
      </tr>
    );
  }

  const isExpanded = expanded;
  return (
    <>
      <tr
        className="border-b transition-colors hover-row cursor-pointer"
        style={{ borderColor: "var(--vscode-panel-border)" }}
        onClick={onToggleExpand}
      >
        <td className="pl-3 pr-1 py-1.5 text-center whitespace-nowrap">
          <Checkbox checked={allChecked} indeterminate={someChecked && !allChecked} onChange={(e) => { e.stopPropagation(); handleGroupCheck(); }} />
        </td>
        <td className="px-3 py-1.5 font-medium whitespace-nowrap">
          <span className="inline-flex items-center gap-1">
            <ChevronIcon expanded={isExpanded} />
            <span className="font-semibold">{group.label}</span>
          </span>
        </td>
        <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: "var(--vscode-descriptionForeground)" }}>{apiDisplay}</td>
        <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: "var(--vscode-descriptionForeground)" }}>{revision}</td>
        <td className="px-3 py-1.5 whitespace-nowrap">
          <StatusText status={status} installedCount={installedCount} totalCount={group.packages.length} pkg={platformPkg} />
        </td>
      </tr>
      {isExpanded &&
        group.packages.map((p) => (
          <tr
            key={p.id}
            className="border-b transition-colors hover-row"
            style={{ borderColor: "var(--vscode-panel-border)" }}
          >
            <td className="pl-8 pr-1 py-1.5 text-center whitespace-nowrap">
              {busyIds.has(p.id) ? <Spinner /> : <Checkbox checked={checked.has(p.id)} onChange={() => onToggleCheck(p.id)} />}
            </td>
            <td className="px-3 py-1.5 pl-10 whitespace-nowrap" style={{ color: "var(--vscode-foreground)" }}>
              {p.displayName}
            </td>
            <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: "var(--vscode-descriptionForeground)" }}>{extractApiKey(p.id) ?? ""}</td>
            <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: "var(--vscode-descriptionForeground)" }}>{p.version}</td>
            <td className="px-3 py-1.5 whitespace-nowrap">
              <StatusText status={p.installed ? (hasRealUpdate(p) ? "update" : "installed") : "not_installed"} pkg={p} />
            </td>
          </tr>
        ))}
    </>
  );
}

/* ── Tool group rows ─────────────────────────────────────────────────────────── */

function ToolGroupRows({
  group,
  showDetails,
  expanded,
  onToggleExpand,
  checked,
  onToggleCheck,
  busyIds,
}: {
  group: ToolGroup;
  showDetails: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  checked: Set<string>;
  onToggleCheck: (id: string) => void;
  busyIds: Set<string>;
}) {
  const status = groupStatus(group.packages);
  const latestPkg = group.packages[0];
  const installedPkg = group.packages.find((p) => p.installed);
  const displayVersion = installedPkg?.version ?? latestPkg?.version ?? "";

  // Group checkbox
  const allChecked = group.packages.every((p) => checked.has(p.id));
  const someChecked = group.packages.some((p) => checked.has(p.id));

  const handleGroupCheck = () => {
    if (allChecked) {
      group.packages.forEach((p) => onToggleCheck(p.id));
    } else {
      group.packages.filter((p) => !checked.has(p.id)).forEach((p) => onToggleCheck(p.id));
    }
  };

  if (group.singleton || !showDetails) {
    const p = group.singleton ? group.packages[0] : undefined;
    const id = p?.id ?? group.packages[0]?.id;
    const isBusy = id ? busyIds.has(id) : false;
    return (
      <tr
        className="border-b transition-colors hover-row"
        style={{ borderColor: "var(--vscode-panel-border)" }}
      >
        <td className="pl-3 pr-1 py-1.5 text-center whitespace-nowrap">
          {isBusy ? <Spinner /> : <Checkbox checked={group.singleton ? checked.has(id!) : allChecked} indeterminate={!group.singleton && someChecked && !allChecked} onChange={group.singleton ? () => onToggleCheck(id!) : handleGroupCheck} />}
        </td>
        <td className="px-3 py-1.5 font-medium whitespace-nowrap">{group.label}</td>
        <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: "var(--vscode-descriptionForeground)" }}>{displayVersion}</td>
        <td className="px-3 py-1.5 whitespace-nowrap">
          <StatusText status={status} installedCount={group.packages.filter((q) => q.installed).length} totalCount={group.packages.length} pkg={installedPkg ?? latestPkg} />
        </td>
      </tr>
    );
  }

  const isExpanded = expanded;
  return (
    <>
      <tr
        className="border-b transition-colors hover-row cursor-pointer"
        style={{ borderColor: "var(--vscode-panel-border)" }}
        onClick={onToggleExpand}
      >
        <td className="pl-3 pr-1 py-1.5 text-center whitespace-nowrap">
          <Checkbox checked={allChecked} indeterminate={someChecked && !allChecked} onChange={(e) => { e.stopPropagation(); handleGroupCheck(); }} />
        </td>
        <td className="px-3 py-1.5 font-medium whitespace-nowrap">
          <span className="inline-flex items-center gap-1">
            <ChevronIcon expanded={isExpanded} />
            <span className="font-semibold">{group.label}</span>
          </span>
        </td>
        <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: "var(--vscode-descriptionForeground)" }}>{displayVersion}</td>
        <td className="px-3 py-1.5 whitespace-nowrap">
          <StatusText status={status} installedCount={group.packages.filter((q) => q.installed).length} totalCount={group.packages.length} pkg={installedPkg ?? latestPkg} />
        </td>
      </tr>
      {isExpanded &&
        group.packages.map((p) => (
          <tr
            key={p.id}
            className="border-b transition-colors hover-row"
            style={{ borderColor: "var(--vscode-panel-border)" }}
          >
            <td className="pl-8 pr-1 py-1.5 text-center whitespace-nowrap">
              {busyIds.has(p.id) ? <Spinner /> : <Checkbox checked={checked.has(p.id)} onChange={() => onToggleCheck(p.id)} />}
            </td>
            <td className="px-3 py-1.5 pl-10 whitespace-nowrap" style={{ color: "var(--vscode-foreground)" }}>
              {p.displayName}
            </td>
            <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: "var(--vscode-descriptionForeground)" }}>{p.version}</td>
            <td className="px-3 py-1.5 whitespace-nowrap">
              <StatusText status={p.installed ? (hasRealUpdate(p) ? "update" : "installed") : "not_installed"} pkg={p} />
            </td>
          </tr>
        ))}
    </>
  );
}

/* ── Shared components ───────────────────────────────────────────────────────── */

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors relative"
      style={{
        color: active ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)",
        backgroundColor: "transparent",
      }}
    >
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ backgroundColor: "var(--vscode-focusBorder)" }}
        />
      )}
    </button>
  );
}

function Checkbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.MouseEvent | React.ChangeEvent) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = !!indeterminate; }}
      onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
      onClick={(e) => e.stopPropagation()}
      className="accent-[var(--vscode-focusBorder)] cursor-pointer"
    />
  );
}

function StatusText({
  status,
  pkg,
}: {
  status: "installed" | "partial" | "not_installed" | "update";
  installedCount?: number;
  totalCount?: number;
  pkg?: SdkPackage;
}) {
  switch (status) {
    case "installed":
      return <span style={{ color: "var(--vscode-terminal-ansiGreen)" }}>Installed</span>;
    case "partial":
      return <span style={{ color: "var(--vscode-editorWarning-foreground)" }}>Partially installed</span>;
    case "not_installed":
      return <span style={{ color: "var(--vscode-descriptionForeground)" }}>Not installed</span>;
    case "update":
      return (
        <span style={{ color: "var(--vscode-textLink-foreground)" }}>
          Update Available{pkg?.availableVersion ? `: ${pkg.availableVersion}` : ""}
        </span>
      );
  }
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.15s",
        color: "var(--vscode-descriptionForeground)",
      }}
    >
      <path d="M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 12.98l-.618-.62 4.357-4.336z" />
    </svg>
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
