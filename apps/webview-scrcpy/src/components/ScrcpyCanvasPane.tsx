import type { PointerEventHandler, RefObject, WheelEventHandler } from "react";
import type { Status } from "../hooks/useScrcpyStream";

interface ScrcpyCanvasPaneProps {
  status: Status;
  errorMessage: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
  onWheel: WheelEventHandler<HTMLCanvasElement>;
}

export function ScrcpyCanvasPane({
  status,
  errorMessage,
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
}: ScrcpyCanvasPaneProps) {
  return (
    <div className="flex-1 flex items-center justify-center overflow-hidden" style={{ background: "var(--vscode-editor-background)" }}>
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />
    </div>
  );
}
