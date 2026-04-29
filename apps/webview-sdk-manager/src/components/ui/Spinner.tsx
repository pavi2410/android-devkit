export function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-2"
      style={{
        borderColor: "var(--vscode-descriptionForeground)",
        borderTopColor: "transparent",
      }}
    />
  );
}
