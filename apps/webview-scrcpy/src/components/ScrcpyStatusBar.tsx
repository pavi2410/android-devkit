import type { Resolution, Status } from "../hooks/useScrcpyStream";

interface ScrcpyStatusBarProps {
  status: Status;
  codec: string;
  resolution: Resolution;
}

export function ScrcpyStatusBar({ status, codec, resolution }: ScrcpyStatusBarProps) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-xs"
      style={{ background: "var(--vscode-titleBar-activeBackground)", color: "var(--vscode-titleBar-activeForeground)" }}
    >
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
      {codec && <span className="opacity-70">{codec.toUpperCase()}</span>}
      {resolution.width > 0 && (
        <span className="opacity-70">
          {resolution.width}x{resolution.height}
        </span>
      )}
    </div>
  );
}
