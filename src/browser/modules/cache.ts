export const CACHE_NAME = "poke-deck-data-v1";
export const CACHE_KEY = "/__poke-deck-cache__/original-151-v1.json";
const CACHE_PREFIX = "poke-deck-data-v";

export async function removeObsoleteCaches(cachesImpl = globalThis.caches) {
  if (!cachesImpl) return;
  const names = await cachesImpl.keys();
  await Promise.all(names
    .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
    .map((name) => cachesImpl.delete(name)));
}

export async function readCachedDataset(cachesImpl = globalThis.caches) {
  if (!cachesImpl) return null;
  const cache = await cachesImpl.open(CACHE_NAME);
  const response = await cache.match(CACHE_KEY);
  if (!response?.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function replaceCachedDataset(payload, cachesImpl = globalThis.caches) {
  if (!cachesImpl) return;
  const cache = await cachesImpl.open(CACHE_NAME);
  await cache.delete(CACHE_KEY);
  await cache.put(CACHE_KEY, new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
}
