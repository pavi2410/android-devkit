import {
  KEYCODE_APP_SWITCH,
  KEYCODE_BACK,
  KEYCODE_HOME,
  KEYCODE_POWER,
  KEYCODE_VOLUME_DOWN,
  KEYCODE_VOLUME_UP,
} from "../types";
import { NavButton } from "./NavButton";

interface ScrcpyNavBarProps {
  sendKey: (keyCode: number) => void;
  onRotate: () => void;
}

export function ScrcpyNavBar({ sendKey, onRotate }: ScrcpyNavBarProps) {
  return (
    <div
      className="flex items-center justify-center gap-1 px-3 py-1.5"
      style={{ background: "var(--vscode-panel-background)", borderTop: "1px solid var(--vscode-panel-border)" }}
    >
      <NavButton label="Vol-" icon="&#x1F509;" onClick={() => sendKey(KEYCODE_VOLUME_DOWN)} />
      <NavButton label="Vol+" icon="&#x1F50A;" onClick={() => sendKey(KEYCODE_VOLUME_UP)} />
      <div className="w-px h-5 mx-1" style={{ background: "var(--vscode-panel-border)" }} />
      <NavButton label="Back" icon="&#x25C0;" onClick={() => sendKey(KEYCODE_BACK)} />
      <NavButton label="Home" icon="&#x25CF;" onClick={() => sendKey(KEYCODE_HOME)} />
      <NavButton label="Recents" icon="&#x25A0;" onClick={() => sendKey(KEYCODE_APP_SWITCH)} />
      <div className="w-px h-5 mx-1" style={{ background: "var(--vscode-panel-border)" }} />
      <NavButton label="Power" icon="&#x23FB;" onClick={() => sendKey(KEYCODE_POWER)} />
      <NavButton label="Rotate" icon="&#x21BB;" onClick={onRotate} />
    </div>
  );
}
