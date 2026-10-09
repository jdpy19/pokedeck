import test from "node:test";
import assert from "node:assert/strict";
import { pokemonTypes, titleCase } from "../dist/components/pokemon-card.js";
import { updateErrorStatus, updateSourceStatus } from "../dist/components/source-status.js";
import { formatTypeSelection } from "../dist/components/type-multi-select.js";

test("card metadata exposes the canonical type choices", () => {
  assert.equal(titleCase("electric"), "Electric");
  assert.equal(pokemonTypes.length, 18);
  assert.deepEqual([...pokemonTypes].sort(), pokemonTypes);
  assert.ok(pokemonTypes.includes("fairy"));
});

test("source status component distinguishes network, cache, and error", () => {
  const label = { textContent: "" };
  const element = { dataset: {}, lastElementChild: label };
  updateSourceStatus(element, {
    source: "network", fetchedAt: "2026-01-02T03:04:05.000Z",
  });
  assert.equal(element.dataset.state, "network");
  assert.match(label.textContent, /Live data/);
  updateSourceStatus(element, {
    source: "cache", fetchedAt: "2026-01-02T03:04:05.000Z",
  });
  assert.equal(element.dataset.state, "cache");
  assert.match(label.textContent, /Offline cache/);
  updateErrorStatus(element);
  assert.equal(element.dataset.state, "error");
});

test("multi-select type label summarizes zero, one, and many choices", () => {
  assert.equal(formatTypeSelection([]), "All types");
  assert.equal(formatTypeSelection(["water"]), "Water");
  assert.equal(formatTypeSelection(["water", "ice"]), "2 types selected");
});
