import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import type { ScrcpyService } from "../services/scrcpy";

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
    const webview = this.panel.webview;
    const distDir = vscode.Uri.joinPath(
      this.context.extensionUri,
      "dist",
      "webview-scrcpy",
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distDir, "index.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distDir, "index.css"),
    );
    const nonce = getNonce();

    const distPath = path.join(
      this.context.extensionUri.fsPath,
      "dist",
      "webview-scrcpy",
    );
    const assetsExist = fs.existsSync(path.join(distPath, "index.js"));

    if (!assetsExist) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Screen Mirror</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none';">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
           background: var(--vscode-editor-background); padding: 2rem; }
  </style>
</head>
<body>
  <h2>Screen Mirror — build required</h2>
  <p>Run the build command to build the Screen Mirror webview assets.</p>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Screen Mirror</title>
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';
             img-src ${webview.cspSource} data:;
             font-src ${webview.cspSource};" />
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    ScrcpyPanel.instances.delete(this.serial);
    this.panel.dispose();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
