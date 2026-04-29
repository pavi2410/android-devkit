import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends Omit<ComponentPropsWithoutRef<typeof BaseButton>, "children"> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, { backgroundColor: string; color: string }> = {
  primary: {
    backgroundColor: "var(--vscode-button-background)",
    color: "var(--vscode-button-foreground)",
  },
  secondary: {
    backgroundColor: "var(--vscode-button-secondaryBackground)",
    color: "var(--vscode-button-secondaryForeground)",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "var(--vscode-descriptionForeground)",
  },
};

export function Button({ variant = "secondary", children, type = "button", className, style, ...props }: ButtonProps) {
  return (
    <BaseButton
      type={type}
      {...props}
      className={`cursor-pointer rounded px-3 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${className ?? ""}`}
      style={{ ...VARIANT_STYLES[variant], ...style }}
    >
      {children}
    </BaseButton>
  );
}
