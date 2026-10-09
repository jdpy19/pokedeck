import type { NamedFilter } from "../../filter-contract.js";

export interface SavedFilterElements {
  select: HTMLSelectElement;
  updateButton: HTMLButtonElement;
  renameButton: HTMLButtonElement;
  deleteButton: HTMLButtonElement;
}

export function setSavedButtons(elements: SavedFilterElements): void {
  const active = Boolean(elements.select.value);
  elements.updateButton.disabled = !active;
  elements.renameButton.disabled = !active;
  elements.deleteButton.disabled = !active;
}

export function renderSavedFilterOptions(filters: NamedFilter[], elements: SavedFilterElements): void {
  const selected = elements.select.value;
  elements.select.replaceChildren(new Option("Choose a filter…", ""));
  filters.forEach((filter) => elements.select.add(new Option(filter.name, filter.id)));
  elements.select.value = filters.some((item) => item.id === selected) ? selected : "";
  setSavedButtons(elements);
}
