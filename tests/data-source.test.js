import test from "node:test";
import assert from "node:assert/strict";
import { API_VERSION, DATA_SCHEMA_VERSION, loadPokemonData } from "../dist/modules/data-source.js";
import { CACHE_KEY, CACHE_NAME, readCachedDataset, removeObsoleteCaches, replaceCachedDataset } from "../dist/modules/cache.js";

class MemoryCacheStorage {
  stores = new Map();
  async keys() { return [...this.stores.keys()]; }
  async delete(name) { return this.stores.delete(name); }
  async open(name) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    const store = this.stores.get(name);
    return {
      match: async (key) => store.get(key)?.clone(),
      put: async (key, response) => store.set(key, response.clone()),
      delete: async (key) => store.delete(key),
    };
  }
}

function rawPokemon(id, invalid = false) {
  return {
    id,
    name: invalid ? null : `pokemon-${id}`,
    sprites: { front_default: `https://img.example/${id}.png` },
    types: [{ slot: 1, type: { name: id % 2 ? "grass" : "water" } }],
  };
}

function fetchStub({ offline = false, invalidAt = 0 } = {}) {
  return async (url) => {
    if (offline) throw new TypeError("offline");
    const id = Number(url.split("/").pop());
    return new Response(JSON.stringify(rawPokemon(id, id === invalidAt)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

function payload(fetchedAt = "2026-01-02T03:04:05.000Z") {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    apiVersion: API_VERSION,
    fetchedAt,
    pokemon: Array.from({ length: 151 }, (_, index) => {
      const raw = rawPokemon(index + 1);
      return {
        id: raw.id, name: raw.name, searchName: raw.name, sprite: raw.sprites.front_default,
        types: raw.types.map((item) => item.type.name), primaryType: raw.types[0].type.name,
        secondaryType: null, hasMultipleTypes: false,
      };
    }),
  };
}

test("network success returns validated data and replaces the cache", async () => {
  const cachesImpl = new MemoryCacheStorage();
  await replaceCachedDataset(payload("2020-01-01T00:00:00.000Z"), cachesImpl);
  const result = await loadPokemonData({
    fetchImpl: fetchStub(), cachesImpl, now: () => new Date("2026-06-01T12:00:00.000Z"),
  });
  assert.equal(result.source, "network");
  assert.equal(result.pokemon.length, 151);
  assert.equal(result.pokemon[0].searchName, "pokemon-1");
  assert.equal((await readCachedDataset(cachesImpl)).fetchedAt, "2026-06-01T12:00:00.000Z");
});

test("offline requests fall back to a valid cached response", async () => {
  const cachesImpl = new MemoryCacheStorage();
  await replaceCachedDataset(payload(), cachesImpl);
  const result = await loadPokemonData({ fetchImpl: fetchStub({ offline: true }), cachesImpl });
  assert.equal(result.source, "cache");
  assert.equal(result.offline, true);
  assert.equal(result.pokemon[150].id, 151);
});

test("invalid API data is rejected and does not overwrite good cache", async () => {
  const cachesImpl = new MemoryCacheStorage();
  const existing = payload("2025-05-05T05:05:05.000Z");
  await replaceCachedDataset(existing, cachesImpl);
  const result = await loadPokemonData({ fetchImpl: fetchStub({ invalidAt: 1 }), cachesImpl });
  assert.equal(result.source, "cache");
  assert.equal((await readCachedDataset(cachesImpl)).fetchedAt, existing.fetchedAt);
});

test("invalid API data with no cache gives a useful error", async () => {
  const cachesImpl = new MemoryCacheStorage();
  await assert.rejects(
    loadPokemonData({ fetchImpl: fetchStub({ invalidAt: 1 }), cachesImpl }),
    /no valid cached Pokédex/,
  );
});

test("cache uses the stable synthetic cache key", async () => {
  const cachesImpl = new MemoryCacheStorage();
  await replaceCachedDataset(payload(), cachesImpl);
  assert.equal(cachesImpl.stores.get(CACHE_NAME).has(CACHE_KEY), true);
});

test("cache cleanup removes only obsolete application-owned versions", async () => {
  const cachesImpl = new MemoryCacheStorage();
  await cachesImpl.open(CACHE_NAME);
  await cachesImpl.open("poke-deck-data-v0");
  await cachesImpl.open("another-app-v1");
  await removeObsoleteCaches(cachesImpl);
  assert.deepEqual((await cachesImpl.keys()).sort(), ["another-app-v1", CACHE_NAME].sort());
});
