import { useCallback, useMemo, useState } from "react";
import type { SdkPackage } from "../types";

interface UseSdkManagerSelectionResult {
  checked: Set<string>;
  expanded: Set<string>;
  showDetails: boolean;
  hideObsolete: boolean;
  pendingInstall: string[];
  pendingUninstall: string[];
  hasPendingChanges: boolean;
  setShowDetails: (value: boolean) => void;
  setHideObsolete: (value: boolean) => void;
  toggleCheck: (id: string) => void;
  toggleExpand: (key: string) => void;
  resetToInstalled: () => void;
  syncWithInstalled: (packages: SdkPackage[]) => void;
}

export function useSdkManagerSelection(packages: SdkPackage[]): UseSdkManagerSelectionResult {
  const [showDetails, setShowDetails] = useState(false);
  const [hideObsolete, setHideObsolete] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const pendingInstall = useMemo(
    () => packages.filter((pkg) => !pkg.installed && checked.has(pkg.id)).map((pkg) => pkg.id),
    [packages, checked],
  );

  const pendingUninstall = useMemo(
    () => packages.filter((pkg) => pkg.installed && !checked.has(pkg.id)).map((pkg) => pkg.id),
    [packages, checked],
  );

  const hasPendingChanges = pendingInstall.length > 0 || pendingUninstall.length > 0;

  const toggleCheck = useCallback((id: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const syncWithInstalled = useCallback((nextPackages: SdkPackage[]) => {
    setChecked(new Set(nextPackages.filter((pkg) => pkg.installed).map((pkg) => pkg.id)));
  }, []);

  const resetToInstalled = useCallback(() => {
    syncWithInstalled(packages);
  }, [packages, syncWithInstalled]);

  return {
    checked,
    expanded,
    showDetails,
    hideObsolete,
    pendingInstall,
    pendingUninstall,
    hasPendingChanges,
    setShowDetails,
    setHideObsolete,
    toggleCheck,
    toggleExpand,
    resetToInstalled,
    syncWithInstalled,
  };
}
