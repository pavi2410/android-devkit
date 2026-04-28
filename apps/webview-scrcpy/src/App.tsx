import { postMessageToHost } from "./lib/vscode";
import { ScrcpyCanvasPane } from "./components/ScrcpyCanvasPane";
import { ScrcpyNavBar } from "./components/ScrcpyNavBar";
import { ScrcpyStatusBar } from "./components/ScrcpyStatusBar";
import { useScrcpyInput } from "./hooks/useScrcpyInput";
import { useScrcpyStream } from "./hooks/useScrcpyStream";

export function App() {
  const { canvasRef, deviceSizeRef, status, errorMessage, resolution, codec } = useScrcpyStream();
  const { handlePointerDown, handlePointerMove, handlePointerUp, handleWheel, sendKey } = useScrcpyInput({
    canvasRef,
    deviceSizeRef,
  });

  return (
    <div className="flex flex-col h-screen">
      <ScrcpyStatusBar status={status} codec={codec} resolution={resolution} />
      <ScrcpyCanvasPane
        status={status}
        errorMessage={errorMessage}
        canvasRef={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />
      <ScrcpyNavBar sendKey={sendKey} onRotate={() => postMessageToHost({ type: "rotate" })} />
    </div>
  );
}
