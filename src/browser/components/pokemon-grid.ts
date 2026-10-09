import type { Pokemon } from "../models.js";
import type { FilterContractV1 } from "../../filter-contract.js";
import { compileFilter } from "../modules/filter.js";
import { createPokemonCard } from "./pokemon-card.js";

interface GridElements {
  grid: HTMLElement;
  empty: HTMLElement;
  count: HTMLElement;
  summary: HTMLElement;
}

export function renderPokemonGrid(dataset: Pokemon[], contract: FilterContractV1, elements: GridElements): number {
  const filtered = dataset.filter(compileFilter(contract));
  const fragment = document.createDocumentFragment();
  filtered.forEach((pokemon) => fragment.append(createPokemonCard(pokemon)));
  elements.grid.replaceChildren(fragment);
  elements.count.textContent = String(filtered.length);
  elements.summary.textContent = filtered.length === dataset.length
    ? "Showing the complete Kanto archive"
    : `Showing ${filtered.length} of ${dataset.length}`;
  elements.empty.hidden = filtered.length !== 0;
  return filtered.length;
}
