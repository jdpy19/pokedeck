import test from "node:test";
import assert from "node:assert/strict";
import { loadSavedFilters, saveSavedFilters, SAVED_FILTERS_KEY } from "../dist/modules/saved-filters.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

const valid = [{
  id: "one", name: "Fire starters", updatedAt: "2026-01-01T00:00:00.000Z",
  contract: { version: 1, where: { field: "types", op: "contains", value: "fire" } },
}];

test("round-trips valid named filters", () => {
  const storage = new MemoryStorage();
  saveSavedFilters(valid, storage);
  assert.deepEqual(loadSavedFilters(storage), valid);
});

test("corrupt localStorage recovers to an empty collection", () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVED_FILTERS_KEY, "{ definitely not json");
  assert.deepEqual(loadSavedFilters(storage), []);
  storage.setItem(SAVED_FILTERS_KEY, JSON.stringify([{ id: "bad", name: "Bad", contract: { version: 99 } }]));
  assert.deepEqual(loadSavedFilters(storage), []);
});
