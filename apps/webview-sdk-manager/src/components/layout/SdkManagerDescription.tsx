interface SdkManagerDescriptionProps {
  tab: "platforms" | "tools";
}

export function SdkManagerDescription({ tab }: SdkManagerDescriptionProps) {
  return (
    <div
      className="border-b px-4 py-2 text-xs"
      style={{
        borderColor: "var(--vscode-panel-border)",
        color: "var(--vscode-descriptionForeground)",
      }}
    >
      {tab === "platforms"
        ? 'Each Android SDK Platform package includes the Android platform and sources pertaining to an API level by default. Once installed, the IDE will automatically check for updates. Check "show package details" to display individual SDK components.'
        : 'Below are the available SDK developer tools. Once installed, the IDE will automatically check for updates. Check "show package details" to display available versions of an SDK Tool.'}
    </div>
  );
}
