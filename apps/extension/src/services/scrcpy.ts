import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  type LocalAdbScrcpyClient,
  type AndroidMotionEventAction,
  type AndroidKeyEventAction,
  type AndroidKeyCode,
  AndroidKeyEventMeta,
} from "@android-devkit/adb";
import type { AdbService } from "./adb";

const SCRCPY_SERVER_VERSION = "v3.3.1";
const SCRCPY_SERVER_FILENAME = `scrcpy-server-${SCRCPY_SERVER_VERSION}`;

interface ScrcpySession {
  client: LocalAdbScrcpyClient;
  panel: vscode.WebviewPanel;
  disposed: boolean;
}

export class ScrcpyService implements vscode.Disposable {
  private sessions = new Map<string, ScrcpySession>();
  private outputChannel = vscode.window.createOutputChannel("ADK: Scrcpy", { log: true });

  constructor(
    private readonly adbService: AdbService,
    private readonly extensionUri: vscode.Uri,
  ) {}

  async startMirroring(serial: string, panel: vscode.WebviewPanel): Promise<void> {
    this.outputChannel.info(`Starting mirroring for device: ${serial}`);

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
        this.outputChannel.error(`Video stream error for ${serial}:`, err);
        // Forward error to webview so it shows error state
        const message = err instanceof Error ? err.message : String(err);
        session.panel.webview.postMessage({ type: "error", message });
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

    // Map numeric codec ID to string
    const codecMap: Record<number, string> = {
      0x68_32_36_34: "h264",  // ScrcpyVideoCodecId.H264
      0x68_32_36_35: "h265",  // ScrcpyVideoCodecId.H265
      0x00_61_76_31: "av1",   // ScrcpyVideoCodecId.AV1
    };
    const codec = codecMap[videoStream.metadata.codec] ?? "h264";

    this.outputChannel.info(`Video stream started for ${serial}: codec=${codec} (raw=${videoStream.metadata.codec}) ${videoStream.metadata.width}x${videoStream.metadata.height}`);

    // Send metadata
    session.panel.webview.postMessage({
      type: "metadata",
      codec,
      width: videoStream.metadata.width,
      height: videoStream.metadata.height,
    });
    this.outputChannel.info(`[${serial}] Sent metadata message to webview`);

    // Read and forward video packets
    const reader = videoStream.stream.getReader();
    let packetCount = 0;
    let configCount = 0;
    try {
      while (!session.disposed) {
        const { done, value } = await reader.read();
        if (done) {
          this.outputChannel.info(`[${serial}] Video stream done after ${packetCount} data packets, ${configCount} config packets`);
          break;
        }

        if (value.type === "configuration") {
          configCount++;
          this.outputChannel.info(`[${serial}] Config packet #${configCount}: ${value.data.byteLength} bytes`);
          // Forward codec config to webview — WebCodecs needs it as the decoder description (SPS/PPS for H264)
          const configBase64 = Buffer.from(value.data).toString("base64");
          session.panel.webview.postMessage({ type: "codecConfig", data: configBase64 });
          continue;
        }

        packetCount++;
        if (packetCount <= 5 || packetCount % 100 === 0) {
          this.outputChannel.info(`[${serial}] Video packet #${packetCount}: keyframe=${value.keyframe} pts=${value.pts} size=${value.data.byteLength}`);
        }

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

    type WebviewMessage =
      | { type: "touch"; action: AndroidMotionEventAction; x: number; y: number; pointerId?: number; screenWidth: number; screenHeight: number; pressure?: number }
      | { type: "key"; action: AndroidKeyEventAction; keyCode: AndroidKeyCode; metaState?: AndroidKeyEventMeta }
      | { type: "text"; text: string }
      | { type: "scroll"; x: number; y: number; screenWidth: number; screenHeight: number; deltaX?: number; deltaY?: number }
      | { type: "clipboard"; content: string }
      | { type: "rotate" };

    const message = msg as WebviewMessage;

    try {
      switch (message.type) {
        case "touch":
          session.client.controller.injectTouch({
            action: message.action,
            pointerId: BigInt(message.pointerId ?? 0),
            pointerX: message.x,
            pointerY: message.y,
            videoWidth: message.screenWidth,
            videoHeight: message.screenHeight,
            pressure: message.pressure ?? 1.0,
            actionButton: 0,
            buttons: 0,
          });
          break;

        case "key":
          session.client.controller.injectKeyCode({
            action: message.action,
            keyCode: message.keyCode,
            repeat: 0,
            metaState: message.metaState ?? AndroidKeyEventMeta.None,
          });
          break;

        case "text":
          session.client.controller.injectText(message.text);
          break;

        case "scroll":
          session.client.controller.injectScroll({
            pointerX: message.x,
            pointerY: message.y,
            videoWidth: message.screenWidth,
            videoHeight: message.screenHeight,
            scrollX: message.deltaX ?? 0,
            scrollY: message.deltaY ?? 0,
            buttons: 0,
          });
          break;

        case "clipboard":
          session.client.controller.setClipboard({
            content: message.content,
            paste: true,
            sequence: 0n,
          });
          break;

        case "rotate":
          session.client.controller.rotateDevice();
          break;
      }
    } catch (err) {
      this.outputChannel.error(`Controller error for ${serial}:`, err);
      session.disposed = true;
      void this.stopMirroring(serial);
    }
  }

  async stopMirroring(serial: string): Promise<void> {
    const session = this.sessions.get(serial);
    if (!session) return;

    this.outputChannel.info(`Stopping mirroring for device: ${serial}`);
    session.disposed = true;
    this.sessions.delete(serial);

    try {
      await session.client.close();
    } catch (err) {
      this.outputChannel.debug(`Cleanup error for ${serial} (ignored):`, err);
    }
  }

  dispose(): void {
    for (const [serial] of this.sessions) {
      void this.stopMirroring(serial);
    }
    this.outputChannel.dispose();
  }
}
