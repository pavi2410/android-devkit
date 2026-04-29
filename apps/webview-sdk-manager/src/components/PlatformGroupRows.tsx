import { extractApiKey, groupStatus, hasRealUpdate, type PlatformGroup } from "../sdk/grouping";
import { TableGroupSection } from "./table/TableGroupSection";
import { StatusText } from "./ui/StatusText";

interface PlatformGroupRowsProps {
  group: PlatformGroup;
  showDetails: boolean;
  expanded: boolean;
  checked: Set<string>;
  busyIds: Set<string>;
  onToggleExpand: () => void;
  onToggleCheck: (id: string) => void;
}

export function PlatformGroupRows({
  group,
  showDetails,
  expanded,
  checked,
  busyIds,
  onToggleExpand,
  onToggleCheck,
}: PlatformGroupRowsProps) {
  const status = groupStatus(group.packages);
  const platformPackage = group.packages.find((pkg) => pkg.category === "platforms");
  const revision = platformPackage?.version ?? "";
  const apiDisplay = group.apiKey;

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
      renderGroupCells={() => (
        <>
          <td className="whitespace-nowrap px-3 py-1.5 font-mono" style={{ color: "var(--vscode-descriptionForeground)" }}>
            {apiDisplay}
          </td>
          <td className="whitespace-nowrap px-3 py-1.5 font-mono" style={{ color: "var(--vscode-descriptionForeground)" }}>
            {revision}
          </td>
          <td className="whitespace-nowrap px-3 py-1.5">
            <StatusText status={status} pkg={platformPackage} />
          </td>
        </>
      )}
      renderItemCells={(pkg) => (
        <>
          <td className="whitespace-nowrap px-3 py-1.5 font-mono" style={{ color: "var(--vscode-descriptionForeground)" }}>
            {extractApiKey(pkg.id) ?? ""}
          </td>
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
