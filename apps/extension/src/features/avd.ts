import * as vscode from "vscode";
import type { ServiceContainer } from "../services/container";
import { AvdManagerProvider } from "../views/avd-manager";
import { registerAvdCommands } from "../commands/avd";
import { CONTEXT_KEYS } from "../commands/ids";
import { setAndroidDevkitContext } from "../config/context";

export function registerAvdFeature(
  context: vscode.ExtensionContext,
  services: ServiceContainer
): void {
  const avdManagerProvider = new AvdManagerProvider(services.sdk, services.adb);

  context.subscriptions.push(
    avdManagerProvider,
    vscode.window.registerTreeDataProvider("androidDevkit.avdManager", avdManagerProvider),
    services.sdk.onAvdsChanged(() => {
      void refreshAvdWelcomeState(services);
    })
  );

  registerAvdCommands(context, services.sdk, avdManagerProvider, services.adb, services.scrcpy);

  void refreshAvdWelcomeState(services);
}

async function refreshAvdWelcomeState(services: ServiceContainer): Promise<void> {
  const sdkConfigured = Boolean(services.sdk.getSdkPath());
  await setAndroidDevkitContext(CONTEXT_KEYS.sdkConfigured, sdkConfigured);

  if (!sdkConfigured) {
    await setAndroidDevkitContext(CONTEXT_KEYS.hasAvds, false);
    return;
  }

  try {
    const avds = await services.sdk.listAvds();
    await setAndroidDevkitContext(CONTEXT_KEYS.hasAvds, avds.length > 0);
  } catch {
    await setAndroidDevkitContext(CONTEXT_KEYS.hasAvds, false);
  }
}
