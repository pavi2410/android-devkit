/**
 * Extracts the numeric API level from an SDK package id.
 * e.g. "platforms;android-36" → 36, "system-images;android-34;..." → 34
 * Returns null when the id contains no android-N segment.
 */
export function extractApiLevel(id: string): number | null {
  const match = id.match(/android-(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1]);
}

/**
 * Comparator for sorting SDK packages newest-first.
 * Extracts API level for numeric comparison; falls back to semver-style
 * version string comparison when no API level is present.
 */
export function compareVersionsDesc(idA: string, verA: string, idB: string, verB: string): number {
  const apiA = extractApiLevel(idA);
  const apiB = extractApiLevel(idB);
  if (apiA !== null && apiB !== null && apiA !== apiB) {
    return apiB - apiA;
  }

  const partsA = verA.split(".").map(Number);
  const partsB = verB.split(".").map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const a = partsA[i] ?? 0;
    const b = partsB[i] ?? 0;
    if (b !== a) return b - a;
  }
  return 0;
}
