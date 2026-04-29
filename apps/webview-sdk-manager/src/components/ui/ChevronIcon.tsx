interface ChevronIconProps {
  expanded: boolean;
}

export function ChevronIcon({ expanded }: ChevronIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.15s",
        color: "var(--vscode-descriptionForeground)",
      }}
    >
      <path d="M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 12.98l-.618-.62 4.357-4.336z" />
    </svg>
  );
}
