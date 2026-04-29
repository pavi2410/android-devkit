import { groupStatus, hasRealUpdate, type ToolGroup } from "../sdk/grouping";
import { TableGroupSection } from "./table/TableGroupSection";
import { Checkbox } from "./ui/Checkbox";
import { Spinner } from "./ui/Spinner";
import { StatusText } from "./ui/StatusText";

interface ToolGroupRowsProps {
  group: ToolGroup;
  showDetails: boolean;
  expanded: boolean;
  checked: Set<string>;
  busyIds: Set<string>;
  onToggleExpand: () => void;
  onToggleCheck: (id: string) => void;
}

export function ToolGroupRows({
  group,
  showDetails,
  expanded,
  checked,
  busyIds,
  onToggleExpand,
  onToggleCheck,
}: ToolGroupRowsProps) {
  const status = groupStatus(group.packages);
  const latestPackage = group.packages[0];
  const installedPackage = group.packages.find((pkg) => pkg.installed);
  const displayVersion = installedPackage?.version ?? latestPackage?.version ?? "";

  const singletonSelectionCell = (() => {
    if (!group.singleton) return undefined;
    const primaryId = group.packages[0]?.id;
    if (!primaryId) return undefined;
    return busyIds.has(primaryId) ? (
      <Spinner />
    ) : (
      <Checkbox checked={checked.has(primaryId)} onChange={() => onToggleCheck(primaryId)} />
    );
  })();

  return (
    <TableGroupSection
      label={group.label}
      items={group.packages}
      checked={checked}
      busyIds={busyIds}
      showDetails={showDetails}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      onToggleCheck={onToggleCheck}
      getItemId={(pkg) => pkg.id}
      getItemLabel={(pkg) => pkg.displayName}
      expandable={!group.singleton}
      summarySelectionCell={singletonSelectionCell}
      renderGroupCells={() => (
        <>
          <td className="whitespace-nowrap px-3 py-1.5 font-mono" style={{ color: "var(--vscode-descriptionForeground)" }}>
            {displayVersion}
          </td>
          <td className="whitespace-nowrap px-3 py-1.5">
            <StatusText status={status} pkg={installedPackage ?? latestPackage} />
          </td>
        </>
      )}
      renderItemCells={(pkg) => (
        <>
          <td className="whitespace-nowrap px-3 py-1.5 font-mono" style={{ color: "var(--vscode-descriptionForeground)" }}>
            {pkg.version}
          </td>
          <td className="whitespace-nowrap px-3 py-1.5">
            <StatusText status={pkg.installed ? (hasRealUpdate(pkg) ? "update" : "installed") : "not_installed"} pkg={pkg} />
          </td>
        </>
      )}
    />
  );
}
