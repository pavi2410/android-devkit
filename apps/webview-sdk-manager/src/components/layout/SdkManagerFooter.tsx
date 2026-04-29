import { Button } from "../ui/Button";
import { CheckboxField } from "../ui/CheckboxField";
import { Spinner } from "../ui/Spinner";

interface SdkManagerFooterProps {
  hideObsolete: boolean;
  showDetails: boolean;
  hasPendingChanges: boolean;
  pendingInstallCount: number;
  pendingUninstallCount: number;
  applying: boolean;
  onHideObsoleteChange: (value: boolean) => void;
  onShowDetailsChange: (value: boolean) => void;
  onCancel: () => void;
  onApply: () => void;
}

export function SdkManagerFooter({
  hideObsolete,
  showDetails,
  hasPendingChanges,
  pendingInstallCount,
  pendingUninstallCount,
  applying,
  onHideObsoleteChange,
  onShowDetailsChange,
  onCancel,
  onApply,
}: SdkManagerFooterProps) {
  return (
    <div
      className="flex items-center justify-between border-t px-4 py-2 text-xs"
      style={{
        backgroundColor: "var(--vscode-sideBar-background, var(--vscode-editor-background))",
        borderColor: "var(--vscode-panel-border)",
      }}
    >
      <div className="flex items-center gap-4">
        <CheckboxField checked={hideObsolete} label="Hide Obsolete Packages" onCheckedChange={onHideObsoleteChange} />
        <CheckboxField checked={showDetails} label="Show Package Details" onCheckedChange={onShowDetailsChange} />
      </div>
      <div className="flex items-center gap-2">
        {hasPendingChanges && (
          <span style={{ color: "var(--vscode-descriptionForeground)" }}>
            {[pendingInstallCount > 0 && `${pendingInstallCount} to install`,
            pendingUninstallCount > 0 && `${pendingUninstallCount} to uninstall`,
            ].filter(Boolean).join(", ")}
          </span>
        )}
        <Button variant="secondary" onClick={onCancel} disabled={!hasPendingChanges || applying}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onApply} disabled={!hasPendingChanges || applying}>
          {applying ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner />
              Applying...
            </span>
          ) : (
            "Apply"
          )}
        </Button>
      </div>
    </div>
  );
}
