import * as vscode from "vscode";
import type { ServiceContainer } from "../services/container";
import type { AdbServerState, AdbServerStatus } from "../services/adb";
import { ANDROID_DEVKIT_COMMANDS } from "../commands/ids";

type AdbStatusAction = "refresh" | "start" | "restart" | "output";

interface AdbStatusQuickPickItem extends vscode.QuickPickItem {
  action?: AdbStatusAction;
}

function stateLabel(state: AdbServerState): string {
  switch (state) {
    case "ready":
      return "Ready";
    case "starting":
      return "Starting";
    case "recovering":
      return "Recovering";
    case "offline":
      return "Offline";
    default:
      return "Unknown";
  }
}

function stateIcon(state: AdbServerState): string {
  switch (state) {
    case "ready":
      return "$(check)";
    case "starting":
      return "$(sync~spin)";
    case "recovering":
      return "$(debug-restart~spin)";
    case "offline":
      return "$(error)";
    default:
      return "$(question)";
  }
}

function formatDate(value: Date | undefined): string {
  return value ? value.toLocaleString() : "Never";
}

function createTooltip(status: AdbServerStatus): vscode.MarkdownString {
  const md = new vscode.MarkdownString(undefined, true);
  md.isTrusted = true;
  md.appendMarkdown(`**ADB ${stateLabel(status.state)}**\n\n`);
  md.appendMarkdown(`- Server: \`${status.host}:${status.port}\`\n`);
  md.appendMarkdown(`- Binary: \`${status.adbPath}\`\n`);
  if (status.sdkPath) {
    md.appendMarkdown(`- SDK: \`${status.sdkPath}\`\n`);
  }
  md.appendMarkdown(`- Version: ${status.version ?? "Unknown"}\n`);
  md.appendMarkdown(`- Devices: ${status.readyDeviceCount ?? 0} ready / ${status.deviceCount ?? 0} total\n`);
  md.appendMarkdown(`- Last checked: ${formatDate(status.lastCheckedAt)}\n`);
  md.appendMarkdown(`- Recoveries: ${status.recoveryCount}\n`);
  if (status.lastRecoveredAt) {
    md.appendMarkdown(`- Last recovered: ${formatDate(status.lastRecoveredAt)}\n`);
  }
  if (status.lastError) {
    md.appendMarkdown(`\n$(error) ${status.lastError}\n`);
  }
  md.appendMarkdown(`\n[Open detailed status](command:${ANDROID_DEVKIT_COMMANDS.showAdbStatus})`);
  return md;
}

function createStatusItems(status: AdbServerStatus): AdbStatusQuickPickItem[] {
  const items: AdbStatusQuickPickItem[] = [
    { label: "$(sync) Refresh Status", description: "Check server and devices", action: "refresh" },
    { label: "$(play) Start ADB Server", description: "Run adb start-server", action: "start" },
    { label: "$(debug-restart) Restart ADB Server", description: "Run adb kill-server, then start-server", action: "restart" },
    { label: "$(output) Show ADB Output", description: "Open Android DevKit ADB logs", action: "output" },
    { label: "", kind: vscode.QuickPickItemKind.Separator },
    { label: "State", description: stateLabel(status.state), detail: status.lastError },
    { label: "Server", description: `${status.host}:${status.port}`, detail: "ADB server endpoint" },
    { label: "ADB Binary", description: status.adbPath },
    { label: "SDK Path", description: status.sdkPath ?? "Not configured" },
    { label: "Server Version", description: status.version?.toString() ?? "Unknown" },
    {
      label: "Devices",
      description: `${status.readyDeviceCount ?? 0} ready / ${status.deviceCount ?? 0} total`,
      detail: "Includes unauthorized, offline, and connected devices.",
    },
    { label: "Last Checked", description: formatDate(status.lastCheckedAt) },
    { label: "Recovery Count", description: status.recoveryCount.toString() },
  ];

  if (status.lastRecoveredAt) {
    items.push({ label: "Last Recovered", description: formatDate(status.lastRecoveredAt) });
  }

  if (status.lastError) {
    items.push({ label: "Last Error", description: status.lastError });
  }

  return items;
}

export function registerAdbStatusFeature(
  context: vscode.ExtensionContext,
  services: ServiceContainer
): void {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBar.command = ANDROID_DEVKIT_COMMANDS.showAdbStatus;
  statusBar.name = "Android DevKit ADB Status";

  const updateStatusBar = (status: AdbServerStatus = services.adb.getStatus()) => {
    statusBar.text = `${stateIcon(status.state)} ADB: ${stateLabel(status.state)}`;
    statusBar.tooltip = createTooltip(status);
    statusBar.show();
  };

  context.subscriptions.push(
    statusBar,
    services.adb.onStatusChanged(updateStatusBar),
    vscode.commands.registerCommand(ANDROID_DEVKIT_COMMANDS.showAdbStatus, async () => {
      let selected: AdbStatusQuickPickItem | undefined;
      do {
        const status = services.adb.getStatus();
        selected = await vscode.window.showQuickPick(createStatusItems(status), {
          title: "Android Debug Bridge Status",
          placeHolder: "Inspect ADB status or choose a recovery action",
        });

        if (!selected?.action) return;

        if (selected.action === "output") {
          services.adb.outputChannel.show(true);
          return;
        }

        try {
          if (selected.action === "refresh") {
            await services.adb.refreshStatus();
          } else if (selected.action === "start") {
            await services.adb.startServer();
          } else if (selected.action === "restart") {
            await services.adb.restartServer();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`ADB ${selected.action} failed: ${message}`);
        }
      } while (selected?.action);
    })
  );

  updateStatusBar();
  void services.adb.refreshStatus();
}
