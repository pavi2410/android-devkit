import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import { getNonce } from "./nonce";

export interface WebviewHtmlOptions {
  webview: vscode.Webview;
  extensionUri: vscode.Uri;
  distSubdir: string;
  title: string;
}

export function buildWebviewHtml(options: WebviewHtmlOptions): string {
  const { webview, extensionUri, distSubdir, title } = options;
  const distDir = vscode.Uri.joinPath(extensionUri, "dist", distSubdir);

  const assetsExist = fs.existsSync(path.join(distDir.fsPath, "index.js"));

  if (!assetsExist) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none';">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
           background: var(--vscode-editor-background); padding: 2rem; }
  </style>
</head>
<body>
  <h2>${title} — build required</h2>
  <p>Run the build command to build the ${title} webview assets.</p>
</body>
</html>`;
  }

  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distDir, "index.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distDir, "index.css"));
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
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
