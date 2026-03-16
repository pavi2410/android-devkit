import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ScrcpyClient } from "@android-devkit/adb";
import type { AdbService } from "./adb";

const SCRCPY_SERVER_VERSION = "v3.3.1";
const SCRCPY_SERVER_FILENAME = `scrcpy-server-${SCRCPY_SERVER_VERSION}`;

interface ScrcpySession {
  client: ScrcpyClient;
  panel: vscode.WebviewPanel;
  disposed: boolean;
}

export class ScrcpyService implements vscode.Disposable {
  private sessions = new Map<string, ScrcpySession>();

  constructor(
    private readonly adbService: AdbService,
    private readonly extensionUri: vscode.Uri,
  ) {}

  async startMirroring(serial: string, panel: vscode.WebviewPanel): Promise<void> {
    // Stop any existing session for this device
    await this.stopMirroring(serial);

    // Push scrcpy server binary to device
    const serverPath = path.join(this.extensionUri.fsPath, "resources", SCRCPY_SERVER_FILENAME);
    if (!fs.existsSync(serverPath)) {
      throw new Error(
        `Scrcpy server binary not found at ${SCRCPY_SERVER_FILENAME}. Place it in the extension resources directory.`,
      );
    }

    const serverBinary = fs.readFileSync(serverPath);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(serverBinary);
        controller.close();
      },
    });

    await this.adbService.pushScrcpyServer(serial, stream);

    // Start scrcpy client
    const client = await this.adbService.startScrcpy(serial);

    const session: ScrcpySession = { client, panel, disposed: false };
    this.sessions.set(serial, session);

    // Handle video stream
    this.pipeVideoToWebview(serial, session).catch((err) => {
      if (!session.disposed) {
        console.error("Scrcpy video stream error:", err);
      }
    });

    // Handle control messages from webview
    panel.webview.onDidReceiveMessage((msg) => {
      this.handleWebviewMessage(serial, msg);
    });

    panel.onDidDispose(() => {
      void this.stopMirroring(serial);
    });
  }

  private async pipeVideoToWebview(serial: string, session: ScrcpySession): Promise<void> {
    const videoStream = await session.client.videoStream;
    if (!videoStream) {
      session.panel.webview.postMessage({
        type: "error",
        message: "No video stream available",
      });
      return;
    }

    // Send metadata
    session.panel.webview.postMessage({
      type: "metadata",
      codec: videoStream.metadata.codec,
      width: videoStream.metadata.width,
      height: videoStream.metadata.height,
    });

    // Read and forward video packets
    const reader = videoStream.stream.getReader();
    try {
      while (!session.disposed) {
        const { done, value } = await reader.read();
        if (done) break;

        // Send packet as base64 to webview (postMessage serializes as JSON)
        const base64 = Buffer.from(value.data).toString("base64");
        session.panel.webview.postMessage({
          type: "videoPacket",
          data: base64,
          keyframe: value.keyframe,
          pts: value.pts ? Number(value.pts) : undefined,
        });
      }
    } finally {
      reader.releaseLock();
    }
  }

  private handleWebviewMessage(serial: string, msg: unknown): void {
    const session = this.sessions.get(serial);
    if (!session || session.disposed || !session.client.controller) return;

    const message = msg as {
      type: string;
      action?: number;
      x?: number;
      y?: number;
      pointerId?: number;
      screenWidth?: number;
      screenHeight?: number;
      pressure?: number;
      keyCode?: number;
      metaState?: number;
      text?: string;
      deltaX?: number;
      deltaY?: number;
      content?: string;
    };

    switch (message.type) {
      case "touch":
        session.client.controller.injectTouch({
          action: message.action!,
          pointerId: BigInt(message.pointerId ?? 0),
          pointerX: message.x!,
          pointerY: message.y!,
          screenWidth: message.screenWidth!,
          screenHeight: message.screenHeight!,
          pressure: message.pressure ?? 1.0,
          actionButton: 0,
          buttons: 0,
        });
        break;

      case "key":
        session.client.controller.injectKeyCode({
          action: message.action!,
          keyCode: message.keyCode!,
          repeat: 0,
          metaState: message.metaState ?? 0,
        });
        break;

      case "text":
        if (message.text) {
          session.client.controller.injectText(message.text);
        }
        break;

      case "scroll":
        session.client.controller.injectScroll({
          pointerX: message.x!,
          pointerY: message.y!,
          screenWidth: message.screenWidth!,
          screenHeight: message.screenHeight!,
          scrollX: message.deltaX ?? 0,
          scrollY: message.deltaY ?? 0,
          buttons: 0,
        });
        break;

      case "clipboard":
        if (message.content) {
          session.client.controller.setClipboard({
            content: message.content,
            paste: true,
            sequence: 0n,
          });
        }
        break;

      case "rotate":
        session.client.controller.rotateDevice();
        break;
    }
  }

  async stopMirroring(serial: string): Promise<void> {
    const session = this.sessions.get(serial);
    if (!session) return;

    session.disposed = true;
    this.sessions.delete(serial);

    try {
      await session.client.close();
    } catch {
      // Ignore errors during cleanup
    }
  }

  dispose(): void {
    for (const [serial] of this.sessions) {
      void this.stopMirroring(serial);
    }
  }
}
