import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import type { SdkService } from "../services/sdk";
import { getOutputChannel } from "../utils/output";

type MessageToHost =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "install"; id: string }
  | { type: "uninstall"; id: string }
  | { type: "updateAll" }
  | { type: "applyChanges"; install: string[]; uninstall: string[] };

type MessageToWebview =
  | { type: "packages"; packages: unknown[]; loading: boolean }
  | { type: "installing"; id: string }
  | { type: "installed"; id: string; success: boolean; error?: string }
  | { type: "uninstalling"; id: string }
  | { type: "uninstalled"; id: string; success: boolean; error?: string }
  | { type: "updatingAll" }
  | { type: "updatedAll"; success: boolean; error?: string };

export class SdkManagerPanel {
  static readonly viewType = "androidDevkit.sdkManagerPage";
  private static instance: SdkManagerPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly outputChannel: vscode.OutputChannel;
  private disposables: vscode.Disposable[] = [];

  static show(
    context: vscode.ExtensionContext,
    sdkService: SdkService
  ): SdkManagerPanel {
    if (SdkManagerPanel.instance) {
      SdkManagerPanel.instance.panel.reveal(vscode.ViewColumn.One);
      return SdkManagerPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      SdkManagerPanel.viewType,
      "SDK Manager",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "dist", "webview-sdk-manager"),
        ],
        retainContextWhenHidden: true,
      }
    );

    SdkManagerPanel.instance = new SdkManagerPanel(panel, context, sdkService);
    return SdkManagerPanel.instance;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly sdkService: SdkService
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();
    this.outputChannel = getOutputChannel("SDK Manager");

    this.panel.webview.onDidReceiveMessage(
      (msg: MessageToHost) => this.handleMessage(msg),
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  private async handleMessage(msg: MessageToHost): Promise<void> {
    switch (msg.type) {
      case "ready":
      case "refresh":
        await this.loadPackages();
        break;

      case "install":
        this.post({ type: "installing", id: msg.id });
        try {
          await this.sdkService.installPackage(msg.id, this.outputChannel);
          this.post({ type: "installed", id: msg.id, success: true });
          await this.loadPackages();
        } catch (e: unknown) {
          const error = e instanceof Error ? e.message : String(e);
          this.post({ type: "installed", id: msg.id, success: false, error });
          vscode.window.showErrorMessage(`Failed to install ${msg.id}: ${error}`);
        }
        break;

      case "uninstall":
        this.post({ type: "uninstalling", id: msg.id });
        try {
          await this.sdkService.uninstallPackage(msg.id, this.outputChannel);
          this.post({ type: "uninstalled", id: msg.id, success: true });
          await this.loadPackages();
        } catch (e: unknown) {
          const error = e instanceof Error ? e.message : String(e);
          this.post({ type: "uninstalled", id: msg.id, success: false, error });
          vscode.window.showErrorMessage(`Failed to uninstall ${msg.id}: ${error}`);
        }
        break;

      case "updateAll":
        this.post({ type: "updatingAll" });
        try {
          await this.sdkService.updateAll(this.outputChannel);
          this.post({ type: "updatedAll", success: true });
          await this.loadPackages();
        } catch (e: unknown) {
          const error = e instanceof Error ? e.message : String(e);
          this.post({ type: "updatedAll", success: false, error });
          vscode.window.showErrorMessage(`Failed to update packages: ${error}`);
        }
        break;

      case "applyChanges":
        await this.handleApplyChanges(msg.install, msg.uninstall);
        break;
    }
  }

  private async handleApplyChanges(installIds: string[], uninstallIds: string[]): Promise<void> {
    const total = installIds.length + uninstallIds.length;
    const errors: string[] = [];

    for (const id of installIds) {
      this.post({ type: "installing", id });
      try {
        await this.sdkService.installPackage(id, this.outputChannel);
        this.post({ type: "installed", id, success: true });
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        this.post({ type: "installed", id, success: false, error });
        errors.push(`Install ${id}: ${error}`);
      }
    }

    for (const id of uninstallIds) {
      this.post({ type: "uninstalling", id });
      try {
        await this.sdkService.uninstallPackage(id, this.outputChannel);
        this.post({ type: "uninstalled", id, success: true });
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        this.post({ type: "uninstalled", id, success: false, error });
        errors.push(`Uninstall ${id}: ${error}`);
      }
    }

    if (errors.length > 0) {
      vscode.window.showErrorMessage(`${errors.length} of ${total} operations failed. Check output for details.`);
    } else {
      vscode.window.showInformationMessage(`Applied ${total} change${total !== 1 ? "s" : ""} successfully.`);
    }

    await this.loadPackages();
  }

  private async loadPackages(): Promise<void> {
    this.post({ type: "packages", packages: [], loading: true });
    try {
      const packages = await this.sdkService.listSdkPackages();
      packages.sort((a, b) => compareVersionsDesc(a.id, a.version, b.id, b.version));
      this.post({ type: "packages", packages, loading: false });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      this.post({ type: "packages", packages: [], loading: false });
      vscode.window.showErrorMessage(`Failed to load SDK packages: ${error}`);
    }
  }

  private post(msg: MessageToWebview): void {
    this.panel.webview.postMessage(msg);
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const distDir = vscode.Uri.joinPath(
      this.context.extensionUri,
      "dist",
      "webview-sdk-manager"
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distDir, "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distDir, "index.css")
    );
    const nonce = getNonce();

    const distPath = path.join(
      this.context.extensionUri.fsPath,
      "dist",
      "webview-sdk-manager"
    );
    const assetsExist = fs.existsSync(path.join(distPath, "index.js"));

    if (!assetsExist) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SDK Manager</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none';">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
           background: var(--vscode-editor-background); padding: 2rem; }
  </style>
</head>
<body>
  <h2>SDK Manager — build required</h2>
  <p>Run the build command to build the SDK Manager webview assets.</p>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SDK Manager</title>
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
    SdkManagerPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}

function extractApiLevel(id: string): number | null {
  const match = id.match(/android-(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1]);
}

function compareVersionsDesc(idA: string, verA: string, idB: string, verB: string): number {
  const apiA = extractApiLevel(idA);
  const apiB = extractApiLevel(idB);
  if (apiA !== null && apiB !== null && apiA !== apiB) {
    return apiB - apiA;
  }
  const partsA = verA.split(".").map(Number);
  const partsB = verB.split(".").map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const a = partsA[i] ?? 0;
    const b = partsB[i] ?? 0;
    if (b !== a) return b - a;
  }
  return 0;
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
