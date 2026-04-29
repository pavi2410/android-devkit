import { useCallback, useEffect, useMemo, useState } from "react";
import { PlatformGroupRows } from "./components/PlatformGroupRows";
import { ToolGroupRows } from "./components/ToolGroupRows";
import { SdkManagerDescription } from "./components/layout/SdkManagerDescription";
import { SdkManagerFooter } from "./components/layout/SdkManagerFooter";
import { SdkManagerHeader } from "./components/layout/SdkManagerHeader";
import { Table, type TableColumn } from "./components/table/Table";
import { Spinner } from "./components/ui/Spinner";
import { useSdkManagerMessages } from "./hooks/useSdkManagerMessages";
import { useSdkManagerSelection } from "./hooks/useSdkManagerSelection";
import { postMessage } from "./lib/vscode";
import { buildPlatformGroups, buildToolGroups } from "./sdk/grouping";

type Tab = "platforms" | "tools";

const TABLE_COLUMNS: Record<Tab, TableColumn[]> = {
  platforms: [
    { id: "select", className: "w-8" },
    { id: "name", header: "Name", className: "px-3 py-2 font-medium" },
    { id: "apiLevel", header: "API Level", className: "w-32 px-3 py-2 font-medium" },
    { id: "revision", header: "Revision", className: "w-20 px-3 py-2 font-medium" },
    { id: "status", header: "Status", className: "w-44 px-3 py-2 font-medium" },
  ],
  tools: [
    { id: "select", className: "w-8" },
    { id: "name", header: "Name", className: "px-3 py-2 font-medium" },
    { id: "version", header: "Version", className: "w-32 px-3 py-2 font-medium" },
    { id: "status", header: "Status", className: "w-44 px-3 py-2 font-medium" },
  ],
};

export function App() {
  const [tab, setTab] = useState<Tab>("platforms");
  const { state, packagesSyncToken, refresh, setApplying } = useSdkManagerMessages();
  const {
    checked,
    expanded,
    showDetails,
    hideObsolete,
    pendingInstall,
    pendingUninstall,
    hasPendingChanges,
    setShowDetails,
    setHideObsolete,
    toggleCheck,
    toggleExpand,
    resetToInstalled,
    syncWithInstalled,
  } = useSdkManagerSelection(state.packages);

  useEffect(() => {
    syncWithInstalled(state.packages);
  }, [packagesSyncToken, state.packages, syncWithInstalled]);

  const filteredPackages = useMemo(() => {
    if (!hideObsolete) return state.packages;
    return state.packages.filter((pkg) => !pkg.obsolete);
  }, [state.packages, hideObsolete]);

  const platformGroups = useMemo(() => buildPlatformGroups(filteredPackages), [filteredPackages]);
  const toolGroups = useMemo(() => buildToolGroups(filteredPackages), [filteredPackages]);

  const handleApply = useCallback(() => {
    if (!hasPendingChanges) return;
    setApplying(true);
    postMessage({
      type: "applyChanges",
      install: pendingInstall,
      uninstall: pendingUninstall,
    });
  }, [hasPendingChanges, pendingInstall, pendingUninstall, setApplying]);

  if (state.loading && state.packages.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm" style={{ color: "var(--vscode-descriptionForeground)" }}>
        <Spinner />
        Loading SDK packages...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col" style={{ color: "var(--vscode-foreground)" }}>
      <SdkManagerHeader tab={tab} loading={state.loading} onSelectTab={setTab} onRefresh={refresh} />
      <SdkManagerDescription tab={tab} />
      <Table
        columns={TABLE_COLUMNS[tab]}
        rows={
          tab === "platforms"
            ? platformGroups.map((group) => (
              <PlatformGroupRows
                key={group.apiKey}
                group={group}
                showDetails={showDetails}
                expanded={expanded.has(group.apiKey)}
                checked={checked}
                busyIds={state.busyIds}
                onToggleExpand={() => toggleExpand(group.apiKey)}
                onToggleCheck={toggleCheck}
              />
            ))
            : toolGroups.map((group) => (
              <ToolGroupRows
                key={group.family}
                group={group}
                showDetails={showDetails}
                expanded={expanded.has(group.family)}
                checked={checked}
                busyIds={state.busyIds}
                onToggleExpand={() => toggleExpand(group.family)}
                onToggleCheck={toggleCheck}
              />
            ))
        }
      />
      <SdkManagerFooter
        hideObsolete={hideObsolete}
        showDetails={showDetails}
        hasPendingChanges={hasPendingChanges}
        pendingInstallCount={pendingInstall.length}
        pendingUninstallCount={pendingUninstall.length}
        applying={state.applying}
        onHideObsoleteChange={setHideObsolete}
        onShowDetailsChange={setShowDetails}
        onCancel={resetToInstalled}
        onApply={handleApply}
      />
    </div>
  );
}
