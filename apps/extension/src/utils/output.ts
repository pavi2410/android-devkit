import * as vscode from "vscode";

const channels = new Map<string, vscode.OutputChannel | vscode.LogOutputChannel>();

/**
 * Get or create a named output channel with "ADK: " prefix.
 * Channels are deduplicated by key — repeated calls return the same instance.
 */
export function getOutputChannel(name: string): vscode.OutputChannel;
export function getOutputChannel(name: string, options: { log: true }): vscode.LogOutputChannel;
export function getOutputChannel(name: string, languageId: string): vscode.OutputChannel;
export function getOutputChannel(
  name: string,
  optionsOrLang?: { log: true } | string
): vscode.OutputChannel | vscode.LogOutputChannel {
  const key = `ADK: ${name}`;
  const existing = channels.get(key);
  if (existing) return existing;

  let channel: vscode.OutputChannel | vscode.LogOutputChannel;
  if (typeof optionsOrLang === "object" && optionsOrLang.log) {
    channel = vscode.window.createOutputChannel(key, { log: true });
  } else if (typeof optionsOrLang === "string") {
    channel = vscode.window.createOutputChannel(key, optionsOrLang);
  } else {
    channel = vscode.window.createOutputChannel(key);
  }

  channels.set(key, channel);
  return channel;
}

export function disposeAllChannels(): void {
  for (const channel of channels.values()) {
    channel.dispose();
  }
  channels.clear();
}
