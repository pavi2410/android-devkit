import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageToWebview, MessageToHost } from "./types";
import {
  ACTION_DOWN,
  ACTION_UP,
  KEYCODE_BACK,
  KEYCODE_HOME,
  KEYCODE_APP_SWITCH,
  KEYCODE_VOLUME_UP,
  KEYCODE_VOLUME_DOWN,
  KEYCODE_POWER,
  TOUCH_ACTION_DOWN,
  TOUCH_ACTION_UP,
  TOUCH_ACTION_MOVE,
} from "./types";

declare function acquireVsCodeApi(): {
  postMessage(msg: MessageToHost): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

type Status = "connecting" | "streaming" | "error";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [resolution, setResolution] = useState({ width: 0, height: 0 });
  const [codec, setCodec] = useState("");
  const decoderRef = useRef<VideoDecoder | null>(null);
  const deviceSizeRef = useRef({ width: 0, height: 0 });
  const codecConfigRef = useRef<Uint8Array | null>(null);

  const renderFrame = useCallback((frame: VideoFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("[scrcpy] renderFrame: canvas not mounted");
      frame.close();
      return;
    }

    const ctx = (ctxRef.current ??= canvas.getContext("2d"));
    if (!ctx) {
      console.warn("[scrcpy] renderFrame: could not get 2d context");
      frame.close();
      return;
    }

    if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
    }

    ctx.drawImage(frame, 0, 0);
    frame.close();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<MessageToWebview>) => {
      const msg = event.data;

      switch (msg.type) {
        case "codecConfig": {
          console.log(`[scrcpy] Codec config received: ${msg.data.length} base64 chars (Annex B SPS/PPS, will prepend to keyframes)`);
          codecConfigRef.current = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));
          break;
        }

        case "metadata": {
          setResolution({ width: msg.width, height: msg.height });
          setCodec(msg.codec);
          deviceSizeRef.current = { width: msg.width, height: msg.height };

          // Initialize WebCodecs decoder
          console.log(`[scrcpy] Metadata received: codec=${msg.codec} ${msg.width}x${msg.height}`);
          if (typeof VideoDecoder !== "undefined") {
            const decoder = new VideoDecoder({
              output: renderFrame,
              error: (err) => {
                console.error("[scrcpy] Decoder error:", err);
                setStatus("error");
                setErrorMessage(`Decoder error: ${err.message}`);
              },
            });

            const codecString =
              msg.codec === "h265"
                ? "hev1.1.60.L153.B0.0.0.0.0.0"
                : msg.codec === "av1"
                ? "av01.0.05M.08"
                : "avc1.640028";

            // Annex B mode: no description needed — SPS/PPS is prepended to keyframes in the stream
            console.log(`[scrcpy] Configuring decoder: codec=${codecString} (Annex B, no description)`);
            decoder.configure({
              codec: codecString,
              optimizeForLatency: true,
            });
            console.log(`[scrcpy] Decoder state after configure: ${decoder.state}`);

            decoderRef.current = decoder;
            setStatus("streaming");
          } else {
            console.error("[scrcpy] VideoDecoder not available");
            setStatus("error");
            setErrorMessage("WebCodecs API not available in this environment");
          }
          break;
        }

        case "videoPacket": {
          const decoder = decoderRef.current;
          if (!decoder || decoder.state === "closed") {
            console.warn(`[scrcpy] Dropping packet — decoder=${decoder ? decoder.state : "null"}`);
            return;
          }

          let bytes = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));

          // Annex B: prepend SPS/PPS config to each keyframe so the decoder can reinitialize
          if (msg.keyframe && codecConfigRef.current) {
            const combined = new Uint8Array(codecConfigRef.current.byteLength + bytes.byteLength);
            combined.set(codecConfigRef.current, 0);
            combined.set(bytes, codecConfigRef.current.byteLength);
            bytes = combined;
          }

          if (decoder.state === "configured") {
            decoder.decode(new EncodedVideoChunk({
              type: msg.keyframe ? "key" : "delta",
              timestamp: msg.pts ?? 0,
              data: bytes,
            }));
          } else {
            console.warn(`[scrcpy] Decoder not in configured state: ${decoder.state}`);
          }
          break;
        }

        case "error":
          setStatus("error");
          setErrorMessage(msg.message);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (decoderRef.current && decoderRef.current.state !== "closed") {
        decoderRef.current.close();
      }
    };
  }, [renderFrame]);

  // Touch/mouse input handling
  const getDeviceCoords = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = deviceSizeRef.current.width / rect.width;
      const scaleY = deviceSizeRef.current.height / rect.height;

      return {
        x: Math.round((e.clientX - rect.left) * scaleX),
        y: Math.round((e.clientY - rect.top) * scaleY),
        screenWidth: deviceSizeRef.current.width,
        screenHeight: deviceSizeRef.current.height,
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const coords = getDeviceCoords(e);
      if (!coords) return;
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      vscode.postMessage({
        type: "touch",
        action: TOUCH_ACTION_DOWN,
        pointerId: e.pointerId,
        pressure: e.pressure,
        ...coords,
      });
    },
    [getDeviceCoords],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.buttons === 0) return;
      const coords = getDeviceCoords(e);
      if (!coords) return;
      vscode.postMessage({
        type: "touch",
        action: TOUCH_ACTION_MOVE,
        pointerId: e.pointerId,
        pressure: e.pressure,
        ...coords,
      });
    },
    [getDeviceCoords],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const coords = getDeviceCoords(e);
      if (!coords) return;
      vscode.postMessage({
        type: "touch",
        action: TOUCH_ACTION_UP,
        pointerId: e.pointerId,
        pressure: 0,
        ...coords,
      });
    },
    [getDeviceCoords],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      const coords = getDeviceCoords(e);
      if (!coords) return;
      vscode.postMessage({
        type: "scroll",
        ...coords,
        deltaX: -Math.sign(e.deltaX),
        deltaY: -Math.sign(e.deltaY),
      });
    },
    [getDeviceCoords],
  );

  const sendKey = useCallback((keyCode: number) => {
    vscode.postMessage({ type: "key", action: ACTION_DOWN, keyCode, metaState: 0 });
    vscode.postMessage({ type: "key", action: ACTION_UP, keyCode, metaState: 0 });
  }, []);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept VS Code shortcuts
      if (e.ctrlKey || e.metaKey) return;
      if (e.key.length === 1) {
        vscode.postMessage({ type: "text", text: e.key });
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs"
        style={{ background: "var(--vscode-titleBar-activeBackground)", color: "var(--vscode-titleBar-activeForeground)" }}>
        <span className="flex items-center gap-1">
          {status === "connecting" && (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              Connecting...
            </>
          )}
          {status === "streaming" && (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
              Streaming
            </>
          )}
          {status === "error" && (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
              Error
            </>
          )}
        </span>
        {codec && (
          <span className="opacity-70">{codec.toUpperCase()}</span>
        )}
        {resolution.width > 0 && (
          <span className="opacity-70">{resolution.width}x{resolution.height}</span>
        )}
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden"
        style={{ background: "var(--vscode-editor-background)" }}>
        {status === "connecting" && (
          <div className="text-center opacity-70">
            <div className="text-lg mb-2">Connecting to device...</div>
            <div className="text-sm">Pushing scrcpy server and starting video stream</div>
          </div>
        )}
        {status === "error" && (
          <div className="text-center">
            <div className="text-lg mb-2" style={{ color: "var(--vscode-errorForeground)" }}>
              Connection Error
            </div>
            <div className="text-sm opacity-70">{errorMessage}</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`max-w-full max-h-full cursor-crosshair ${status !== "streaming" ? "hidden" : ""}`}
          style={{ objectFit: "contain" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        />
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-center gap-1 px-3 py-1.5"
        style={{ background: "var(--vscode-panel-background)", borderTop: "1px solid var(--vscode-panel-border)" }}>
        <NavButton label="Vol-" icon="&#x1F509;" onClick={() => sendKey(KEYCODE_VOLUME_DOWN)} />
        <NavButton label="Vol+" icon="&#x1F50A;" onClick={() => sendKey(KEYCODE_VOLUME_UP)} />
        <div className="w-px h-5 mx-1" style={{ background: "var(--vscode-panel-border)" }} />
        <NavButton label="Back" icon="&#x25C0;" onClick={() => sendKey(KEYCODE_BACK)} />
        <NavButton label="Home" icon="&#x25CF;" onClick={() => sendKey(KEYCODE_HOME)} />
        <NavButton label="Recents" icon="&#x25A0;" onClick={() => sendKey(KEYCODE_APP_SWITCH)} />
        <div className="w-px h-5 mx-1" style={{ background: "var(--vscode-panel-border)" }} />
        <NavButton label="Power" icon="&#x23FB;" onClick={() => sendKey(KEYCODE_POWER)} />
        <NavButton label="Rotate" icon="&#x21BB;" onClick={() => vscode.postMessage({ type: "rotate" })} />
      </div>
    </div>
  );
}

function NavButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      title={label}
      onClick={onClick}
      className="px-3 py-1 rounded text-sm cursor-pointer hover:opacity-80 transition-opacity"
      style={{
        background: "var(--vscode-button-secondaryBackground)",
        color: "var(--vscode-button-secondaryForeground)",
        border: "none",
      }}
    >
      {icon}
    </button>
  );
}
