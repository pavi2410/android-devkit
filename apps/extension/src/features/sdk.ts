import * as vscode from "vscode";
import type { ServiceContainer } from "../services/container";
import { registerSdkCommands } from "../commands/sdk";

export function registerSdkFeature(
  context: vscode.ExtensionContext,
  services: ServiceContainer
): void {
  registerSdkCommands(context, services.sdk);
}
