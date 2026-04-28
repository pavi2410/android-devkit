import type { MessageToHost } from "../types";

declare function acquireVsCodeApi(): {
  postMessage(msg: MessageToHost): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

export function postMessageToHost(msg: MessageToHost): void {
  vscode.postMessage(msg);
}
