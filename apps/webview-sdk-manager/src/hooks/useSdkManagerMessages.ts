import { useCallback, useEffect, useState } from "react";
import { postMessage } from "../lib/vscode";
import type { MessageToWebview, SdkPackage } from "../types";

export interface SdkManagerAppState {
  packages: SdkPackage[];
  loading: boolean;
  busyIds: Set<string>;
  applying: boolean;
}

const initialState: SdkManagerAppState = {
  packages: [],
  loading: true,
  busyIds: new Set(),
  applying: false,
};

interface UseSdkManagerMessagesResult {
  state: SdkManagerAppState;
  packagesSyncToken: number;
  refresh: () => void;
  setApplying: (isApplying: boolean) => void;
}

export function useSdkManagerMessages(): UseSdkManagerMessagesResult {
  const [state, setState] = useState<SdkManagerAppState>(initialState);
  const [packagesSyncToken, setPackagesSyncToken] = useState(0);

  useEffect(() => {
    const handler = (event: MessageEvent<MessageToWebview>) => {
      const message = event.data;
      switch (message.type) {
        case "packages":
          setState((current) => ({
            ...current,
            packages: message.packages,
            loading: message.loading,
            applying: false,
          }));
          setPackagesSyncToken((token) => token + 1);
          break;
        case "installing":
          setState((current) => ({ ...current, busyIds: new Set(current.busyIds).add(message.id) }));
          break;
        case "installed":
          setState((current) => {
            const busyIds = new Set(current.busyIds);
            busyIds.delete(message.id);
            const packages = message.success
              ? current.packages.map((pkg) => (pkg.id === message.id ? { ...pkg, installed: true } : pkg))
              : current.packages;
            return { ...current, busyIds, packages };
          });
          break;
        case "uninstalling":
          setState((current) => ({ ...current, busyIds: new Set(current.busyIds).add(message.id) }));
          break;
        case "uninstalled":
          setState((current) => {
            const busyIds = new Set(current.busyIds);
            busyIds.delete(message.id);
            const packages = message.success
              ? current.packages.map((pkg) => (pkg.id === message.id ? { ...pkg, installed: false } : pkg))
              : current.packages;
            return { ...current, busyIds, packages };
          });
          break;
        case "updatingAll":
          setState((current) => ({ ...current, applying: true }));
          break;
        case "updatedAll":
          setState((current) => ({ ...current, applying: false }));
          break;
      }
    };

    window.addEventListener("message", handler);
    postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  const refresh = useCallback(() => {
    postMessage({ type: "refresh" });
  }, []);

  const setApplying = useCallback((isApplying: boolean) => {
    setState((current) => ({ ...current, applying: isApplying }));
  }, []);

  return {
    state,
    packagesSyncToken,
    refresh,
    setApplying,
  };
}
