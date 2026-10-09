export interface Pokemon {
  id: number;
  name: string;
  searchName: string;
  sprite: string;
  types: string[];
  primaryType: string;
  secondaryType: string | null;
  hasMultipleTypes: boolean;
}

export interface DatasetPayload {
  schemaVersion: 1;
  apiVersion: "pokeapi-v2";
  fetchedAt: string;
  pokemon: Pokemon[];
  source?: "network" | "cache";
  offline?: boolean;
}
