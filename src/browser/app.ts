import type { FilterContractV1, NamedFilter } from "../filter-contract.js";
import type { DatasetPayload, Pokemon } from "./models.js";
import { validateFilterContract } from "./modules/filter.js";
import { loadPokemonData } from "./modules/data-source.js";
import { removeObsoleteCaches } from "./modules/cache.js";
import { loadSavedFilters, saveSavedFilters } from "./modules/saved-filters.js";
import { pokemonTypes } from "./components/pokemon-card.js";
import { renderPokemonGrid } from "./components/pokemon-grid.js";
import { updateErrorStatus, updateSourceStatus } from "./components/source-status.js";
import { renderSavedFilterOptions, setSavedButtons } from "./components/saved-filter-list.js";
import { openFilterNameDialog } from "./components/filter-name-dialog.js";
import { mountTypeMultiSelect } from "./components/type-multi-select.js";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

const elements = {
  refresh: requireElement<HTMLButtonElement>("#refreshButton"),
  retry: requireElement<HTMLButtonElement>("#retryButton"),
  source: requireElement<HTMLElement>("#sourceStatus"),
  name: requireElement<HTMLInputElement>("#nameFilter"),
  type: requireElement<HTMLDetailsElement>("#typeFilter"),
  typeLabel: requireElement<HTMLElement>("#typeFilterLabel"),
  typeOptions: requireElement<HTMLElement>("#typeFilterOptions"),
  clear: requireElement<HTMLButtonElement>("#clearFilters"),
  grid: requireElement<HTMLElement>("#pokemonGrid"),
  loading: requireElement<HTMLElement>("#loadingState"),
  error: requireElement<HTMLElement>("#errorState"),
  empty: requireElement<HTMLElement>("#emptyState"),
  errorMessage: requireElement<HTMLElement>("#errorMessage"),
  count: requireElement<HTMLElement>("#resultCount"),
  summary: requireElement<HTMLElement>("#resultSummary"),
  editor: requireElement<HTMLTextAreaElement>("#filterEditor"),
  apply: requireElement<HTMLButtonElement>("#applyFilter"),
  filterError: requireElement<HTMLElement>("#filterError"),
  savedSelect: requireElement<HTMLSelectElement>("#savedFilterSelect"),
  newFilter: requireElement<HTMLButtonElement>("#newFilter"),
  updateFilter: requireElement<HTMLButtonElement>("#updateFilter"),
  renameFilter: requireElement<HTMLButtonElement>("#renameFilter"),
  deleteFilter: requireElement<HTMLButtonElement>("#deleteFilter"),
  dialog: requireElement<HTMLDialogElement>("#nameDialog"),
  form: requireElement<HTMLFormElement>("#nameForm"),
  dialogTitle: requireElement<HTMLElement>("#dialogTitle"),
  dialogEyebrow: requireElement<HTMLElement>("#dialogEyebrow"),
  filterName: requireElement<HTMLInputElement>("#filterName"),
  nameError: requireElement<HTMLElement>("#nameError"),
  confirmName: requireElement<HTMLButtonElement>("#confirmName"),
};

const savedElements = {
  select: elements.savedSelect,
  updateButton: elements.updateFilter,
  renameButton: elements.renameFilter,
  deleteButton: elements.deleteFilter,
};

const dialogElements = {
  dialog: elements.dialog,
  form: elements.form,
  eyebrow: elements.dialogEyebrow,
  title: elements.dialogTitle,
  input: elements.filterName,
  error: elements.nameError,
  confirmButton: elements.confirmName,
};

let dataset: Pokemon[] = [];
let activeContract: FilterContractV1 = defaultContract();
let savedFilters: NamedFilter[] = loadSavedFilters();
let namingMode: "create" | "rename" = "create";
let typeFilter: ReturnType<typeof mountTypeMultiSelect>;

function defaultContract(): FilterContractV1 {
  return { version: 1, where: { and: [{ field: "name", op: "contains", value: "" }] } };
}

function quickContract(): FilterContractV1 {
  const and: FilterContractV1["where"][] = [];
  const name = elements.name.value.trim();
  const types = typeFilter.selected();
  if (name) and.push({ field: "name", op: "contains", value: name });
  if (types.length) and.push({ field: "types", op: "in", value: types });
  if (!and.length) and.push({ field: "name", op: "contains", value: "" });
  return { version: 1, where: { and } };
}

function syncEditor(contract: FilterContractV1): void {
  elements.editor.value = JSON.stringify(contract, null, 2);
}

function render(): void {
  if (!dataset.length) return;
  try {
    renderPokemonGrid(dataset, activeContract, elements);
    elements.filterError.textContent = "";
  } catch (error) {
    elements.filterError.textContent = error instanceof Error ? error.message : "Invalid filter";
  }
}

function setLoading(loading: boolean): void {
  elements.refresh.disabled = loading;
  elements.refresh.textContent = loading ? "Refreshing…" : "Refresh data";
  elements.loading.hidden = !loading || dataset.length > 0;
  if (loading) elements.error.hidden = true;
}

async function refreshData(): Promise<void> {
  setLoading(true);
  try {
    const payload = await loadPokemonData() as DatasetPayload;
    dataset = payload.pokemon;
    updateSourceStatus(elements.source, payload);
    elements.error.hidden = true;
    render();
  } catch (error) {
    elements.error.hidden = false;
    elements.errorMessage.textContent = error instanceof Error ? error.message : "Unable to load data.";
    updateErrorStatus(elements.source);
  } finally {
    setLoading(false);
  }
}

function useQuickFilters(): void {
  activeContract = quickContract();
  elements.savedSelect.value = "";
  setSavedButtons(savedElements);
  syncEditor(activeContract);
  render();
}

function readEditor(): FilterContractV1 {
  return validateFilterContract(JSON.parse(elements.editor.value)) as FilterContractV1;
}

function applyEditor(): void {
  try {
    activeContract = readEditor();
    elements.name.value = "";
    typeFilter.clear();
    render();
  } catch (error) {
    elements.filterError.textContent = error instanceof SyntaxError
      ? `Invalid JSON: ${error.message}`
      : error instanceof Error ? error.message : "Invalid filter";
  }
}

function selectedSaved(): NamedFilter | undefined {
  return savedFilters.find((item) => item.id === elements.savedSelect.value);
}

function persistSavedFilters(): void {
  saveSavedFilters(savedFilters);
  renderSavedFilterOptions(savedFilters, savedElements);
}

elements.form.addEventListener("submit", (event: SubmitEvent) => {
  if ((event.submitter as HTMLButtonElement | null)?.value === "cancel") return;
  event.preventDefault();
  const name = elements.filterName.value.trim();
  if (!name) { elements.nameError.textContent = "Enter a name."; return; }
  const duplicate = savedFilters.some((item) =>
    item.name.toLocaleLowerCase() === name.toLocaleLowerCase() && item.id !== elements.savedSelect.value);
  if (duplicate) { elements.nameError.textContent = "That name is already in use."; return; }

  if (namingMode === "create") {
    try { activeContract = readEditor(); }
    catch (error) {
      elements.dialog.close();
      elements.filterError.textContent = error instanceof Error ? error.message : "Invalid filter";
      return;
    }
    const item: NamedFilter = {
      id: crypto.randomUUID(), name, contract: activeContract, updatedAt: new Date().toISOString(),
    };
    savedFilters.push(item);
    persistSavedFilters();
    elements.savedSelect.value = item.id;
  } else {
    const item = selectedSaved();
    if (item) item.name = name;
    persistSavedFilters();
    elements.savedSelect.value = item?.id ?? "";
  }
  setSavedButtons(savedElements);
  elements.dialog.close();
});

elements.name.addEventListener("input", useQuickFilters);
elements.clear.addEventListener("click", () => {
  elements.name.value = "";
  typeFilter.clear();
  useQuickFilters();
});
elements.apply.addEventListener("click", applyEditor);
elements.refresh.addEventListener("click", refreshData);
elements.retry.addEventListener("click", refreshData);
elements.newFilter.addEventListener("click", () => {
  namingMode = "create";
  openFilterNameDialog(dialogElements, namingMode);
});
elements.renameFilter.addEventListener("click", () => {
  namingMode = "rename";
  openFilterNameDialog(dialogElements, namingMode, selectedSaved()?.name ?? "");
});
elements.updateFilter.addEventListener("click", () => {
  const item = selectedSaved();
  if (!item) return;
  try {
    activeContract = readEditor();
    item.contract = activeContract;
    item.updatedAt = new Date().toISOString();
    saveSavedFilters(savedFilters);
    elements.filterError.textContent = "Saved filter updated.";
  } catch (error) {
    elements.filterError.textContent = error instanceof Error ? error.message : "Invalid filter";
  }
});
elements.deleteFilter.addEventListener("click", () => {
  const item = selectedSaved();
  if (!item || !confirm(`Delete “${item.name}”?`)) return;
  savedFilters = savedFilters.filter((filter) => filter.id !== item.id);
  persistSavedFilters();
});
elements.savedSelect.addEventListener("change", () => {
  const item = selectedSaved();
  if (item) {
    activeContract = item.contract;
    syncEditor(activeContract);
    elements.name.value = "";
    typeFilter.clear();
    render();
  }
  setSavedButtons(savedElements);
});

typeFilter = mountTypeMultiSelect({
  root: elements.type,
  label: elements.typeLabel,
  options: elements.typeOptions,
}, pokemonTypes, useQuickFilters);
syncEditor(activeContract);
renderSavedFilterOptions(savedFilters, savedElements);
removeObsoleteCaches().catch(() => {});
refreshData();
