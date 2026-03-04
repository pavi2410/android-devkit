import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import type { SdkService } from "../services/sdk";

type MessageToHost =
  | { type: "selectSdkPath" }
  | { type: "openView"; viewId: string }
  | { type: "openExternal"; url: string };

type MessageToWebview =
  | { type: "init"; sdkPath: string | null; version: string }
  | { type: "sdkPathUpdated"; path: string };

export class WelcomePanel {
  static readonly viewType = "androidDevkit.welcome";
  private static instance: WelcomePanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static show(
    context: vscode.ExtensionContext,
    sdkService: SdkService
  ): WelcomePanel {
    if (WelcomePanel.instance) {
      WelcomePanel.instance.panel.reveal(vscode.ViewColumn.One);
      return WelcomePanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      WelcomePanel.viewType,
      "Android DevKit — Welcome",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "dist", "webview-welcome"),
        ],
        retainContextWhenHidden: true,
      }
    );

    WelcomePanel.instance = new WelcomePanel(panel, context, sdkService);
    return WelcomePanel.instance;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly sdkService: SdkService
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage(
      (msg: MessageToHost) => this.handleMessage(msg),
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  private handleMessage(msg: MessageToHost): void {
    switch (msg.type) {
      case "selectSdkPath":
        this.handleSelectSdkPath();
        break;

      case "openView":
        if (msg.viewId === "__ready__") {
          this.sendInit();
        } else {
          vscode.commands.executeCommand(`${msg.viewId}.focus`);
        }
        break;

      case "openExternal":
        vscode.env.openExternal(vscode.Uri.parse(msg.url));
        break;
    }
  }

  private async handleSelectSdkPath(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      title: "Select Android SDK directory",
    });
    if (!uris || uris.length === 0) return;

    const sdkPath = uris[0].fsPath;
    await vscode.workspace
      .getConfiguration("androidDevkit")
      .update("sdkPath", sdkPath, vscode.ConfigurationTarget.Global);

    this.post({ type: "sdkPathUpdated", path: sdkPath });
    vscode.window.showInformationMessage(`Android SDK path set to: ${sdkPath}`);
  }

  private sendInit(): void {
    const ext = this.context.extension;
    const version = (ext.packageJSON as { version?: string }).version ?? "0.1.0";
    this.post({
      type: "init",
      sdkPath: this.sdkService.getSdkPath() ?? null,
      version,
    });
  }

  private post(msg: MessageToWebview): void {
    this.panel.webview.postMessage(msg);
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const distDir = vscode.Uri.joinPath(
      this.context.extensionUri,
      "dist",
      "webview-welcome"
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distDir, "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distDir, "index.css")
    );
    const nonce = getNonce();

    // Check if built assets exist (they won't in dev without running webview build)
    const distPath = path.join(
      this.context.extensionUri.fsPath,
      "dist",
      "webview-welcome"
    );
    const assetsExist = fs.existsSync(path.join(distPath, "index.js"));

    if (!assetsExist) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Android DevKit</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none';">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
           background: var(--vscode-editor-background); padding: 2rem; }
  </style>
</head>
<body>
  <h2>Welcome — build required</h2>
  <p>Run <code>mise run build:webview</code> to build the welcome page assets.</p>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Android DevKit — Welcome</title>
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
    WelcomePanel.instance = undefined;
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
