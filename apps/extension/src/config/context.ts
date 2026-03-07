import * as vscode from "vscode";
import { CONTEXT_KEYS, VS_CODE_COMMANDS } from "../commands/ids";

export type AndroidDevkitContextKey = (typeof CONTEXT_KEYS)[keyof typeof CONTEXT_KEYS];

export function setAndroidDevkitContext(
  key: AndroidDevkitContextKey,
  value: boolean | string | number | undefined
): Thenable<unknown> {
  return vscode.commands.executeCommand(VS_CODE_COMMANDS.setContext, key, value);
}
