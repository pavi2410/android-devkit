import type { ReactNode } from "react";
import { ChevronIcon } from "../ui/ChevronIcon";

interface TableGroupSummaryRowProps {
  selectionCell: ReactNode;
  label: string;
  children: ReactNode;
}

export function TableGroupSummaryRow({ selectionCell, label, children }: TableGroupSummaryRowProps) {
  return (
    <tr className="hover-row border-b transition-colors" style={{ borderColor: "var(--vscode-panel-border)" }}>
      <td className="whitespace-nowrap py-1.5 pl-3 pr-1 text-center">{selectionCell}</td>
      <td className="whitespace-nowrap px-3 py-1.5 font-medium">{label}</td>
      {children}
    </tr>
  );
}

interface TableGroupExpandableRowProps {
  selectionCell: ReactNode;
  label: string;
  expanded: boolean;
  onToggleExpand: () => void;
  children: ReactNode;
}

export function TableGroupExpandableRow({
  selectionCell,
  label,
  expanded,
  onToggleExpand,
  children,
}: TableGroupExpandableRowProps) {
  return (
    <tr
      className="hover-row cursor-pointer border-b transition-colors"
      style={{ borderColor: "var(--vscode-panel-border)" }}
      onClick={onToggleExpand}
    >
      <td className="whitespace-nowrap py-1.5 pl-3 pr-1 text-center">{selectionCell}</td>
      <td className="whitespace-nowrap px-3 py-1.5 font-medium">
        <span className="inline-flex items-center gap-1">
          <ChevronIcon expanded={expanded} />
          <span className="font-semibold">{label}</span>
        </span>
      </td>
      {children}
    </tr>
  );
}

interface TableDetailRowProps {
  selectionCell: ReactNode;
  name: ReactNode;
  children: ReactNode;
}

export function TableDetailRow({ selectionCell, name, children }: TableDetailRowProps) {
  return (
    <tr className="hover-row border-b transition-colors" style={{ borderColor: "var(--vscode-panel-border)" }}>
      <td className="whitespace-nowrap py-1.5 pl-8 pr-1 text-center">{selectionCell}</td>
      <td className="whitespace-nowrap py-1.5 pl-10 pr-3" style={{ color: "var(--vscode-foreground)" }}>
        {name}
      </td>
      {children}
    </tr>
  );
}
