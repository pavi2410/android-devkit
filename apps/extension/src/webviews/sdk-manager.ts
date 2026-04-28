import * as vscode from "vscode";
import type { SdkService } from "../services/sdk";
import { getOutputChannel } from "../utils/output";
import { buildWebviewHtml } from "../utils/webview-html";
import { compareVersionsDesc } from "../utils/sdk-version";

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
    panel.iconPath = new vscode.ThemeIcon("package");

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
    return buildWebviewHtml({
      webview: this.panel.webview,
      extensionUri: this.context.extensionUri,
      distSubdir: "webview-sdk-manager",
      title: "SDK Manager",
    });
  }

  dispose(): void {
    SdkManagerPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}


