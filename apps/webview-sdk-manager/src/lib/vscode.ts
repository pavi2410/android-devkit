import type { MessageToHost } from "../types";

declare const acquireVsCodeApi: () => {
  postMessage: (message: MessageToHost) => void;
};

const vscode = typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

export function postMessage(message: MessageToHost) {
  vscode?.postMessage(message);
}
