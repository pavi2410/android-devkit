import type { ReactNode } from "react";
import { Checkbox } from "../ui/Checkbox";
import { Spinner } from "../ui/Spinner";
import { TableDetailRow, TableGroupExpandableRow, TableGroupSummaryRow } from "./TableRows";

interface TableGroupSectionProps<TItem> {
  label: string;
  items: TItem[];
  checked: Set<string>;
  busyIds: Set<string>;
  showDetails: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleCheck: (id: string) => void;
  getItemId: (item: TItem) => string;
  getItemLabel: (item: TItem) => ReactNode;
  renderGroupCells: () => ReactNode;
  renderItemCells: (item: TItem) => ReactNode;
  expandable?: boolean;
  summarySelectionCell?: ReactNode;
}

export function TableGroupSection<TItem>({
  label,
  items,
  checked,
  busyIds,
  showDetails,
  expanded,
  onToggleExpand,
  onToggleCheck,
  getItemId,
  getItemLabel,
  renderGroupCells,
  renderItemCells,
  expandable = true,
  summarySelectionCell,
}: TableGroupSectionProps<TItem>) {
  const itemIds = items.map(getItemId);
  const allChecked = itemIds.every((id) => checked.has(id));
  const someChecked = itemIds.some((id) => checked.has(id));

  const onGroupCheckboxChange = () => {
    if (allChecked) {
      itemIds.forEach((id) => onToggleCheck(id));
      return;
    }
    itemIds.filter((id) => !checked.has(id)).forEach((id) => onToggleCheck(id));
  };

  const groupSelectionCell = (
    <Checkbox checked={allChecked} indeterminate={someChecked && !allChecked} onChange={onGroupCheckboxChange} />
  );
  const summaryCell = summarySelectionCell ?? groupSelectionCell;
  const isDetailMode = showDetails && expandable;

  if (!isDetailMode) {
    return (
      <TableGroupSummaryRow selectionCell={summaryCell} label={label}>
        {renderGroupCells()}
      </TableGroupSummaryRow>
    );
  }

  return (
    <>
      <TableGroupExpandableRow
        selectionCell={groupSelectionCell}
        label={label}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
      >
        {renderGroupCells()}
      </TableGroupExpandableRow>
      {expanded &&
        items.map((item) => {
          const itemId = getItemId(item);

          return (
            <TableDetailRow
              key={itemId}
              selectionCell={
                busyIds.has(itemId) ? (
                  <Spinner />
                ) : (
                  <Checkbox checked={checked.has(itemId)} onChange={() => onToggleCheck(itemId)} />
                )
              }
              name={getItemLabel(item)}
            >
              {renderItemCells(item)}
            </TableDetailRow>
          );
        })}
    </>
  );
}
