import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { MessageToWebview } from "../types";

export type Status = "connecting" | "streaming" | "error";

export interface Resolution {
  width: number;
  height: number;
}

interface UseScrcpyStreamResult {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  deviceSizeRef: MutableRefObject<Resolution>;
  status: Status;
  errorMessage: string;
  resolution: Resolution;
  codec: string;
}

export function useScrcpyStream(): UseScrcpyStreamResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [resolution, setResolution] = useState<Resolution>({ width: 0, height: 0 });
  const [codec, setCodec] = useState("");
  const decoderRef = useRef<VideoDecoder | null>(null);
  const deviceSizeRef = useRef<Resolution>({ width: 0, height: 0 });
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
          console.log(
            `[scrcpy] Codec config received: ${msg.data.length} base64 chars (Annex B SPS/PPS, will prepend to keyframes)`,
          );
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
            decoder.decode(
              new EncodedVideoChunk({
                type: msg.keyframe ? "key" : "delta",
                timestamp: msg.pts ?? 0,
                data: bytes,
              }),
            );
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

  return {
    canvasRef,
    deviceSizeRef,
    status,
    errorMessage,
    resolution,
    codec,
  };
}
