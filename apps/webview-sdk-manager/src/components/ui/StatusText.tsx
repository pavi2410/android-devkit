import type { GroupStatus } from "../../sdk/grouping";
import type { SdkPackage } from "../../types";

interface StatusTextProps {
  status: GroupStatus;
  pkg?: SdkPackage;
}

export function StatusText({ status, pkg }: StatusTextProps) {
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
