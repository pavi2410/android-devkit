import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";

interface CheckboxFieldProps {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}

export function CheckboxField({ checked, label, onCheckedChange }: CheckboxFieldProps) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5" style={{ color: "var(--vscode-descriptionForeground)" }}>
      <BaseCheckbox.Root
        checked={checked}
        onCheckedChange={(nextChecked) => onCheckedChange(Boolean(nextChecked))}
        className="flex h-3.5 w-3.5 items-center justify-center rounded border border-(--vscode-checkbox-border) bg-(--vscode-checkbox-background) data-checked:border-(--vscode-focusBorder) data-checked:bg-(--vscode-inputOption-activeBackground)"
      >
        <BaseCheckbox.Indicator className="text-[10px] leading-none text-(--vscode-inputOption-activeForeground)">
          ✓
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      {label}
    </label>
  );
}
