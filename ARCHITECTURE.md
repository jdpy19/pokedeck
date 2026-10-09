# Architecture

Crystal 151 is a static, browser-only application. It deliberately avoids a backend, database, WebAssembly, synchronization service, analytics pipeline, and cloud persistence.

## Methodology

The project was approached as a one-shot exercise in building the smallest well-architected application that fully met the brief.

The conversation progressively established the product boundary: only the original 151 Pokémon, client-side fetching and filtering, recoverable browser caching, validated versioned filter definitions, and static S3/CloudFront delivery. Native browser and platform capabilities were favored over dependencies or speculative abstractions.

Implementation followed those constraints directly. TypeScript source was divided into small focused components, risky inputs and API responses were validated at their boundaries, infrastructure reused an existing proven Terraform pattern, and focused tests covered the behaviors most likely to fail.

The result aims to be complete enough to deploy in one pass while remaining easy to understand, verify, and replace.

## Application structure

- `src/browser/app.ts` is the composition root and keeps the active dataset as an in-memory array.
- `src/browser/components/` contains focused card, grid, type-filter, source-status, saved-list, and dialog components.
- `src/browser/modules/data-source.ts` owns PokéAPI fetching and response normalization.
- `src/browser/modules/cache.ts` owns Cache API access and application-cache cleanup.
- `src/browser/modules/filter.ts` validates and compiles filter contracts.
- `src/browser/modules/saved-filters.ts` owns the versioned `localStorage` collection.
- `src/filter-contract.ts` contains the public filter-contract TypeScript types.
- `src/browser/models.ts` contains the normalized dataset types.

The build emits native browser ES modules. There is no application runtime dependency or bundler.

## Dataset and normalization

“Original 151” means National Pokédex IDs 1 through 151. The app requests `https://pokeapi.co/api/v2/pokemon/{id}` with a 12-request worker pool because the list endpoint does not include types or sprites.

Every response is validated before it enters the active array or cache. Normalized records contain:

- numeric Pokédex ID;
- lowercase name and precomputed search name;
- HTTPS front-sprite URL;
- ordered type list;
- primary and nullable secondary type; and
- a precomputed multiple-type boolean.

A manual refresh intentionally refetches the complete small dataset. Partial refreshes are never exposed or cached.

## Filter execution

Filter definitions are inert, versioned JSON. They are validated and normalized, compiled once into closures, and executed using `Array.prototype.filter()`. The implementation never uses `eval`, `Function`, dynamic property traversal, or executable expressions.

The default UI combines name and type constraints with `and`. Selecting multiple types produces one `in` comparison, so a Pokémon matches when any of its types is selected.

### Filter contract v1

```json
{
  "version": 1,
  "where": {
    "and": [
      { "field": "types", "op": "in", "value": ["water", "ice"] },
      { "field": "id", "op": "lte", "value": 151 },
      {
        "not": { "field": "name", "op": "startsWith", "value": "mega" }
      }
    ]
  }
}
```

Logical operators are `and`, `or`, and `not`. Comparison operators are `eq`, `neq`, `in`, `notIn`, `contains`, `startsWith`, `exists`, `gt`, `gte`, `lt`, and `lte`.

Allowlisted fields:

| Field | Value | Notes |
| --- | --- | --- |
| `id` | number | All comparisons, including numeric ranges |
| `name` | string | Equality, set, contains, prefix, and existence |
| `types` | string array | `contains` checks membership; `in` checks overlap |
| `primaryType` | string | String comparisons |
| `secondaryType` | string or null | String/null comparisons and existence |
| `hasMultipleTypes` | boolean | Equality, set, and existence |

String comparisons are case-insensitive. A missing field never matches comparisons, including `neq` and `notIn`. `eq: null` matches an explicit null only. `exists: true` means present and non-null; `exists: false` means missing or null.

Validation rejects unknown versions, extra keys, non-allowlisted fields, field/operator mismatches, malformed values, empty or oversized `in` lists, trees deeper than six levels, and trees larger than 80 nodes.

## Cache lifecycle and offline behavior

The aggregate dataset is cached under the stable synthetic key `/__poke-deck-cache__/original-151-v1.json` in the versioned cache `poke-deck-data-v1`.

1. Startup removes only obsolete caches with the application-owned `poke-deck-data-v` prefix.
2. A network refresh fetches and validates all 151 records.
3. Only a complete, valid aggregate replaces the previous cache entry.
4. Network or validation failure falls back to the last valid cached aggregate.
5. If neither source is valid, the UI presents a retryable error instead of partial data.

Cache metadata includes `fetchedAt`, `schemaVersion: 1`, and `apiVersion: "pokeapi-v2"`. The UI displays whether the active data came from the network or cache and when it was fetched.

## Local persistence and security boundaries

Only named filter definitions are written to `localStorage`, under `poke-deck:saved-filters:v1`. Corrupt or incompatible stored data is recoverable and restores an empty collection.

No credentials, authorization headers, secrets, raw API responses, or user records are stored in `localStorage` or the Cache API.

The browser must be able to reach `https://pokeapi.co`. The CloudFront Content Security Policy permits that API in `connect-src` and PokéAPI sprites from `raw.githubusercontent.com` in `img-src`. The application depends on PokéAPI’s CORS support.

## Hosting architecture

Terraform provisions:

- a private S3 bucket with public access blocked;
- CloudFront Origin Access Control for signed S3 access;
- an ACM certificate in `us-east-1`;
- Route 53 certificate-validation and site alias records;
- HTTPS redirection, compression, and no cookie/query forwarding;
- a CloudFront security-header policy; and
- `index.html` fallback responses for static SPA routing.

Deployments give `index.html` a no-cache policy, give other static assets a short revalidating cache policy, and invalidate CloudFront after upload.

## Assumptions and remaining decisions

- PokéAPI is public and does not require account-specific headers. A synthetic cache key is still used so remote request details never become the browser-cache identity.
- The default sprite is PokéAPI’s front sprite for each original Pokémon.
- Terraform state remains local unless a remote backend is configured for CI or multiple operators.
- AWS account/profile selection, remote-state policy, and CI credentials remain environment-specific.
- There is no background synchronization, database, analytics, service worker, or cloud persistence.
