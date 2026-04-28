import { useCallback, useEffect } from "react";
import type { MutableRefObject, PointerEvent as ReactPointerEvent, RefObject, WheelEvent as ReactWheelEvent } from "react";
import {
  ACTION_DOWN,
  ACTION_UP,
  TOUCH_ACTION_DOWN,
  TOUCH_ACTION_MOVE,
  TOUCH_ACTION_UP,
} from "../types";
import { postMessageToHost } from "../lib/vscode";

interface DeviceSize {
  width: number;
  height: number;
}

interface DeviceCoords {
  x: number;
  y: number;
  screenWidth: number;
  screenHeight: number;
}

interface UseScrcpyInputParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  deviceSizeRef: MutableRefObject<DeviceSize>;
}

interface UseScrcpyInputResult {
  handlePointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  handleWheel: (e: ReactWheelEvent<HTMLCanvasElement>) => void;
  sendKey: (keyCode: number) => void;
}

export function useScrcpyInput({ canvasRef, deviceSizeRef }: UseScrcpyInputParams): UseScrcpyInputResult {
  const getDeviceCoords = useCallback(
    (e: { clientX: number; clientY: number }): DeviceCoords | null => {
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
    [canvasRef, deviceSizeRef],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const coords = getDeviceCoords(e);
      if (!coords) return;
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      postMessageToHost({
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
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (e.buttons === 0) return;
      const coords = getDeviceCoords(e);
      if (!coords) return;
      postMessageToHost({
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
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const coords = getDeviceCoords(e);
      if (!coords) return;
      postMessageToHost({
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
    (e: ReactWheelEvent<HTMLCanvasElement>) => {
      const coords = getDeviceCoords(e);
      if (!coords) return;
      postMessageToHost({
        type: "scroll",
        ...coords,
        deltaX: -Math.sign(e.deltaX),
        deltaY: -Math.sign(e.deltaY),
      });
    },
    [getDeviceCoords],
  );

  const sendKey = useCallback((keyCode: number) => {
    postMessageToHost({ type: "key", action: ACTION_DOWN, keyCode, metaState: 0 });
    postMessageToHost({ type: "key", action: ACTION_UP, keyCode, metaState: 0 });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept VS Code shortcuts
      if (e.ctrlKey || e.metaKey) return;
      if (e.key.length === 1) {
        postMessageToHost({ type: "text", text: e.key });
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    sendKey,
  };
}
