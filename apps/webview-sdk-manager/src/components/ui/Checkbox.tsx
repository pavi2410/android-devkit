import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}

export function Checkbox({ checked, indeterminate, onChange }: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      checked={checked}
      indeterminate={indeterminate}
      onCheckedChange={() => onChange()}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      className="flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded border border-(--vscode-checkbox-border) bg-(--vscode-checkbox-background) data-checked:border-(--vscode-focusBorder) data-checked:bg-(--vscode-inputOption-activeBackground)"
    >
      <BaseCheckbox.Indicator className="text-[10px] leading-none text-(--vscode-inputOption-activeForeground)">
        {indeterminate ? "−" : "✓"}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
