import type { DatasetPayload } from "../models.js";

export function updateSourceStatus(element: HTMLElement, payload: DatasetPayload): void {
  const fetched = new Date(payload.fetchedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  element.dataset.state = payload.source;
  const label = element.lastElementChild;
  if (label) {
    label.textContent = payload.source === "network"
      ? `Live data · fetched ${fetched}`
      : `Offline cache · fetched ${fetched}`;
  }
}

export function updateErrorStatus(element: HTMLElement): void {
  element.dataset.state = "error";
  const label = element.lastElementChild;
  if (label) label.textContent = "No network or cached data";
}
