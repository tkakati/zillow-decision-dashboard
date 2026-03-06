export const STORAGE_KEYS = {
  preferences: "decision-dashboard.preferences",
  selectedAttributes: "decision-dashboard.selected-attributes",
  attributeWeights: "decision-dashboard.attribute-weights",
  rowOrder: "decision-dashboard.row-order",
  aiInsightsEnabled: "decision-dashboard.ai-insights-enabled",
  listingStages: "decision-dashboard.listing-stages",
} as const;

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota and access errors.
  }
}

export function reconcileRowOrder(order: string[], availableIds: string[]): string[] {
  const seen = new Set(order);
  const filtered = order.filter((id) => availableIds.includes(id));
  const missing = availableIds.filter((id) => !seen.has(id));
  return [...filtered, ...missing];
}
