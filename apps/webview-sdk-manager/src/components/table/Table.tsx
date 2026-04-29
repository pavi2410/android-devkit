import type { ReactNode } from "react";

export interface TableColumn {
  id: string;
  header?: ReactNode;
  className?: string;
}

interface TableProps {
  columns: TableColumn[];
  rows: ReactNode;
}

export function Table({ columns, rows }: TableProps) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr
            className="sticky top-0 z-10 whitespace-nowrap text-left text-xs"
            style={{
              backgroundColor: "var(--vscode-editor-background)",
              color: "var(--vscode-descriptionForeground)",
              borderBottom: "1px solid var(--vscode-panel-border)",
            }}
          >
            {columns.map((column) => (
              <th key={column.id} className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
