import { readCachedDataset, replaceCachedDataset } from "./cache.js";

export const API_URL = "https://pokeapi.co/api/v2/pokemon";
export const DATA_SCHEMA_VERSION = 1;
export const API_VERSION = "pokeapi-v2";
const TOTAL = 151;

function validUrl(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export function normalizePokemon(raw, expectedId) {
  if (!raw || raw.id !== expectedId || typeof raw.name !== "string" || !raw.name.trim()) {
    throw new Error(`Invalid Pokémon response for #${expectedId}`);
  }
  const sprite = raw.sprites?.front_default;
  if (typeof sprite !== "string" || !validUrl(sprite)) throw new Error(`Missing sprite for #${expectedId}`);
  if (!Array.isArray(raw.types) || raw.types.length === 0 || raw.types.length > 2) {
    throw new Error(`Invalid types for #${expectedId}`);
  }
  const types = raw.types
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => entry?.type?.name);
  if (types.some((type) => typeof type !== "string" || !/^[a-z-]+$/.test(type))) {
    throw new Error(`Invalid type name for #${expectedId}`);
  }
  const name = raw.name.trim().toLocaleLowerCase();
  return Object.freeze({
    id: expectedId,
    name,
    searchName: name,
    sprite,
    types,
    primaryType: types[0],
    secondaryType: types[1] ?? null,
    hasMultipleTypes: types.length > 1,
  });
}

export function validateDatasetPayload(payload) {
  if (!payload || payload.schemaVersion !== DATA_SCHEMA_VERSION || payload.apiVersion !== API_VERSION ||
      typeof payload.fetchedAt !== "string" || Number.isNaN(Date.parse(payload.fetchedAt)) ||
      !Array.isArray(payload.pokemon) || payload.pokemon.length !== TOTAL) {
    throw new Error("Cached dataset is invalid");
  }
  const normalized = payload.pokemon.map((item, index) => {
    const id = index + 1;
    return normalizePokemon({
      id: item.id,
      name: item.name,
      sprites: { front_default: item.sprite },
      types: item.types?.map((type, typeIndex) => ({ slot: typeIndex + 1, type: { name: type } })),
    }, id);
  });
  return { ...payload, pokemon: normalized };
}

async function fetchOne(id, fetchImpl) {
  const response = await fetchImpl(`${API_URL}/${id}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`PokéAPI returned ${response.status} for #${id}`);
  return normalizePokemon(await response.json(), id);
}

export async function fetchPokemonDataset(fetchImpl = globalThis.fetch, now = () => new Date()) {
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable");
  const results = new Array(TOTAL);
  let nextId = 1;
  async function worker() {
    while (nextId <= TOTAL) {
      const id = nextId++;
      results[id - 1] = await fetchOne(id, fetchImpl);
    }
  }
  await Promise.all(Array.from({ length: 12 }, worker));
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    apiVersion: API_VERSION,
    fetchedAt: now().toISOString(),
    pokemon: results,
  };
}

export async function loadPokemonData({
  fetchImpl = globalThis.fetch,
  cachesImpl = globalThis.caches,
  now = () => new Date(),
} = {}) {
  try {
    const networkPayload = validateDatasetPayload(await fetchPokemonDataset(fetchImpl, now));
    await replaceCachedDataset(networkPayload, cachesImpl);
    return { ...networkPayload, source: "network", offline: false };
  } catch (networkError) {
    const cached = await readCachedDataset(cachesImpl);
    if (cached) {
      try {
        return { ...validateDatasetPayload(cached), source: "cache", offline: true, networkError };
      } catch { /* keep the useful network error below */ }
    }
    const error = new Error("PokéAPI is unavailable and no valid cached Pokédex was found.");
    error.cause = networkError;
    throw error;
  }
}
