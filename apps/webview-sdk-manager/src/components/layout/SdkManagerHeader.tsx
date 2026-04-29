import { Tabs } from "@base-ui/react/tabs";
import { Button } from "../ui/Button";

interface SdkManagerHeaderProps {
  tab: "platforms" | "tools";
  loading: boolean;
  onSelectTab: (tab: "platforms" | "tools") => void;
  onRefresh: () => void;
}

export function SdkManagerHeader({ tab, loading, onSelectTab, onRefresh }: SdkManagerHeaderProps) {
  return (
    <div
      className="flex items-center border-b"
      style={{
        backgroundColor: "var(--vscode-editor-background)",
        borderColor: "var(--vscode-panel-border)",
      }}
    >
      <Tabs.Root
        value={tab}
        onValueChange={(value) => onSelectTab(value as "platforms" | "tools")}
        className="flex items-center"
      >
        <Tabs.List className="relative flex">
          <Tabs.Tab
            value="platforms"
            className="cursor-pointer px-4 py-2.5 text-sm font-medium text-(--vscode-descriptionForeground) transition-colors data-active:text-(--vscode-foreground)"
          >
            SDK Platforms
          </Tabs.Tab>
          <Tabs.Tab
            value="tools"
            className="cursor-pointer px-4 py-2.5 text-sm font-medium text-(--vscode-descriptionForeground) transition-colors data-active:text-(--vscode-foreground)"
          >
            SDK Tools
          </Tabs.Tab>
          <Tabs.Indicator
            className="absolute h-0.5 bg-(--vscode-focusBorder) transition-[left,width] duration-150"
            style={{
              left: "var(--active-tab-left)",
              width: "var(--active-tab-width)",
              bottom: 0,
            }}
          />
        </Tabs.List>
      </Tabs.Root>
      <div className="ml-auto flex items-center gap-2 px-3">
        <Button
          variant="ghost"
          onClick={onRefresh}
          disabled={loading}
          className="px-2 py-1 text-xs disabled:opacity-40"
          title="Refresh"
          aria-label="Refresh SDK packages"
        >
          ↻
        </Button>
      </div>
    </div>
  );
}
