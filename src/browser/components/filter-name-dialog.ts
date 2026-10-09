export interface FilterNameDialogElements {
  dialog: HTMLDialogElement;
  form: HTMLFormElement;
  eyebrow: HTMLElement;
  title: HTMLElement;
  input: HTMLInputElement;
  error: HTMLElement;
  confirmButton: HTMLButtonElement;
}

export function openFilterNameDialog(
  elements: FilterNameDialogElements,
  mode: "create" | "rename",
  existingName = "",
): void {
  elements.eyebrow.textContent = mode === "create" ? "SAVE FILTER" : "RENAME FILTER";
  elements.title.textContent = mode === "create" ? "Name this filter" : "Choose a new name";
  elements.confirmButton.textContent = mode === "create" ? "Save" : "Rename";
  elements.input.value = mode === "rename" ? existingName : "";
  elements.error.textContent = "";
  elements.dialog.showModal();
  elements.input.focus();
}
