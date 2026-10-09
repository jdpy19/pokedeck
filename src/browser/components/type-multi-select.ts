import { titleCase } from "./pokemon-card.js";

export interface TypeMultiSelectElements {
  root: HTMLDetailsElement;
  label: HTMLElement;
  options: HTMLElement;
}

export interface TypeMultiSelectController {
  selected(): string[];
  clear(): void;
}

export function formatTypeSelection(values: string[]): string {
  if (values.length === 0) return "All types";
  if (values.length === 1) return titleCase(values[0]);
  return `${values.length} types selected`;
}

export function mountTypeMultiSelect(
  elements: TypeMultiSelectElements,
  types: string[],
  onChange: () => void,
): TypeMultiSelectController {
  const inputs: HTMLInputElement[] = [];

  for (const type of types) {
    const option = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = type;
    input.id = `pokemon-type-${type}`;
    input.name = `pokemon-type-${type}`;
    input.autocomplete = "off";
    input.checked = false;
    input.defaultChecked = false;
    const text = document.createElement("span");
    text.textContent = titleCase(type);
    option.htmlFor = input.id;
    option.append(input, text);
    elements.options.append(option);
    inputs.push(input);
  }

  const selected = (): string[] => inputs.filter((input) => input.checked).map((input) => input.value);
  const refresh = (): void => { elements.label.textContent = formatTypeSelection(selected()); };

  elements.options.addEventListener("change", () => {
    refresh();
    onChange();
  });

  return {
    selected,
    clear() {
      inputs.forEach((input) => { input.checked = false; });
      refresh();
    },
  };
}
