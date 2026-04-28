import * as vscode from "vscode";
import type { ScrcpyService } from "../services/scrcpy";
import { buildWebviewHtml } from "../utils/webview-html";

export class ScrcpyPanel {
  static readonly viewType = "androidDevkit.scrcpyPage";
  private static instances = new Map<string, ScrcpyPanel>();

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static show(
    context: vscode.ExtensionContext,
    scrcpyService: ScrcpyService,
    serial: string,
    deviceName: string,
  ): ScrcpyPanel {
    const existing = ScrcpyPanel.instances.get(serial);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.One);
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      ScrcpyPanel.viewType,
      `Mirror: ${deviceName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "dist", "webview-scrcpy"),
        ],
        retainContextWhenHidden: true,
      },
    );

    const instance = new ScrcpyPanel(panel, context, scrcpyService, serial);
    ScrcpyPanel.instances.set(serial, instance);
    return instance;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly scrcpyService: ScrcpyService,
    private readonly serial: string,
  ) {
    this.panel = panel;
    this.panel.iconPath = new vscode.ThemeIcon("device-mobile");
    this.panel.webview.html = this.getHtml();

    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);

    // Start mirroring
    this.scrcpyService.startMirroring(serial, this.panel).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to start screen mirroring: ${message}`);
      this.panel.webview.postMessage({ type: "error", message });
    });
  }

  private getHtml(): string {
    return buildWebviewHtml({
      webview: this.panel.webview,
      extensionUri: this.context.extensionUri,
      distSubdir: "webview-scrcpy",
      title: "Screen Mirror",
    });
  }

  dispose(): void {
    ScrcpyPanel.instances.delete(this.serial);
    this.panel.dispose();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}

