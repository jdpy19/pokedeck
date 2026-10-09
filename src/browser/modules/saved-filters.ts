import { validateFilterContract } from "./filter.js";

export const SAVED_FILTERS_KEY = "poke-deck:saved-filters:v1";

export function loadSavedFilters(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(SAVED_FILTERS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      if (!item || typeof item.id !== "string" || typeof item.name !== "string" || !item.name.trim()) {
        throw new Error("invalid saved filter");
      }
      return { ...item, name: item.name.trim(), contract: validateFilterContract(item.contract) };
    });
  } catch {
    return [];
  }
}

export function saveSavedFilters(filters, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
}
