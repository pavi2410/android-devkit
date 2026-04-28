interface NavButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
}

export function NavButton({ label, icon, onClick }: NavButtonProps) {
  return (
    <button
      title={label}
      onClick={onClick}
      className="px-3 py-1 rounded text-sm cursor-pointer hover:opacity-80 transition-opacity"
      style={{
        background: "var(--vscode-button-secondaryBackground)",
        color: "var(--vscode-button-secondaryForeground)",
        border: "none",
      }}
    >
      {icon}
    </button>
  );
}
