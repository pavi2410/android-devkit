/** Messages from the extension host to the webview */
export type MessageToWebview =
  | { type: "metadata"; codec: string; width: number; height: number }
  | { type: "videoPacket"; data: string; keyframe?: boolean; pts?: number }
  | { type: "error"; message: string };

/** Messages from the webview to the extension host */
export type MessageToHost =
  | {
      type: "touch";
      action: number;
      x: number;
      y: number;
      pointerId: number;
      screenWidth: number;
      screenHeight: number;
      pressure: number;
    }
  | {
      type: "key";
      action: number;
      keyCode: number;
      metaState: number;
    }
  | { type: "text"; text: string }
  | {
      type: "scroll";
      x: number;
      y: number;
      screenWidth: number;
      screenHeight: number;
      deltaX: number;
      deltaY: number;
    }
  | { type: "clipboard"; content: string }
  | { type: "rotate" };

// Android key action constants
export const ACTION_DOWN = 0;
export const ACTION_UP = 1;
export const ACTION_MOVE = 2;

// Android keycode constants
export const KEYCODE_BACK = 4;
export const KEYCODE_HOME = 3;
export const KEYCODE_APP_SWITCH = 187;
export const KEYCODE_POWER = 26;
export const KEYCODE_VOLUME_UP = 24;
export const KEYCODE_VOLUME_DOWN = 25;

// Touch action constants (Android MotionEvent)
export const TOUCH_ACTION_DOWN = 0;
export const TOUCH_ACTION_UP = 1;
export const TOUCH_ACTION_MOVE = 2;
