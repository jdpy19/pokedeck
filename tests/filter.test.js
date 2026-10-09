import test from "node:test";
import assert from "node:assert/strict";
import { compileFilter, MAX_FILTER_DEPTH, MAX_FILTER_NODES, validateFilterContract } from "../dist/modules/filter.js";

const records = [
  { id: 1, name: "bulbasaur", types: ["grass", "poison"], primaryType: "grass", secondaryType: "poison", hasMultipleTypes: true },
  { id: 4, name: "charmander", types: ["fire"], primaryType: "fire", secondaryType: null, hasMultipleTypes: false },
  { id: 7, name: "squirtle", types: ["water"], primaryType: "water", secondaryType: null, hasMultipleTypes: false },
];

const contract = (where) => ({ version: 1, where });
const matches = (where) => records.filter(compileFilter(contract(where))).map((item) => item.id);

test("compiles nested and/or/not expressions", () => {
  assert.deepEqual(matches({
    and: [
      { or: [
        { field: "types", op: "contains", value: "GRASS" },
        { field: "types", op: "contains", value: "fire" },
      ] },
      { not: { field: "name", op: "startsWith", value: "CHAR" } },
    ],
  }), [1]);
});

test("supports every comparison operator", () => {
  assert.deepEqual(matches({ field: "name", op: "eq", value: "BULBASAUR" }), [1]);
  assert.deepEqual(matches({ field: "name", op: "neq", value: "bulbasaur" }), [4, 7]);
  assert.deepEqual(matches({ field: "name", op: "in", value: ["SQUIRTLE", "missingno"] }), [7]);
  assert.deepEqual(matches({ field: "name", op: "notIn", value: ["squirtle"] }), [1, 4]);
  assert.deepEqual(matches({ field: "name", op: "contains", value: "SAUR" }), [1]);
  assert.deepEqual(matches({ field: "name", op: "startsWith", value: "char" }), [4]);
  assert.deepEqual(matches({ field: "secondaryType", op: "exists", value: true }), [1]);
  assert.deepEqual(matches({ field: "id", op: "gt", value: 4 }), [7]);
  assert.deepEqual(matches({ field: "id", op: "gte", value: 4 }), [4, 7]);
  assert.deepEqual(matches({ field: "id", op: "lt", value: 4 }), [1]);
  assert.deepEqual(matches({ field: "id", op: "lte", value: 4 }), [1, 4]);
});

test("handles missing and null fields explicitly", () => {
  const missing = { id: 99, name: "missing", types: [], primaryType: "unknown", hasMultipleTypes: false };
  assert.equal(compileFilter(contract({ field: "secondaryType", op: "exists", value: false }))(records[1]), true);
  assert.equal(compileFilter(contract({ field: "secondaryType", op: "exists", value: false }))(missing), true);
  assert.equal(compileFilter(contract({ field: "secondaryType", op: "eq", value: null }))(records[1]), true);
  assert.equal(compileFilter(contract({ field: "secondaryType", op: "eq", value: null }))(missing), false);
  assert.equal(compileFilter(contract({ field: "secondaryType", op: "neq", value: null }))(missing), false);
});

test("rejects invalid contracts and unsupported versions", () => {
  assert.throws(() => validateFilterContract({ version: 2, where: {} }), /unsupported version/);
  assert.throws(() => validateFilterContract(contract({ field: "id", op: "contains", value: "1" })), /not allowed/);
  assert.throws(() => validateFilterContract(contract({ and: [] })), /non-empty array/);
  assert.throws(() => validateFilterContract(contract({ field: "id", op: "in", value: [] })), /requires 1–50/);
});

test("enforces the maximum expression depth", () => {
  let expression = { field: "name", op: "eq", value: "bulbasaur" };
  for (let index = 0; index < MAX_FILTER_DEPTH; index += 1) expression = { not: expression };
  assert.throws(() => validateFilterContract(contract(expression)), /maximum depth/);
});

test("enforces the maximum expression tree size", () => {
  const leaves = Array.from({ length: MAX_FILTER_NODES }, () => ({
    field: "name", op: "contains", value: "a",
  }));
  assert.throws(() => validateFilterContract(contract({ and: leaves })), /exceeds 80 nodes/);
});

test("malicious fields and operators are rejected, never executed", () => {
  globalThis.__filterExploit = 0;
  assert.throws(() => compileFilter(contract({
    field: "__proto__",
    op: "eq",
    value: "globalThis.__filterExploit=1",
  })), /not allowed/);
  assert.throws(() => compileFilter(contract({
    field: "constructor.constructor('globalThis.__filterExploit=1')()",
    op: "eq",
    value: true,
  })), /not allowed/);
  assert.throws(() => compileFilter(contract({
    field: "name",
    op: "constructor",
    value: "globalThis.__filterExploit=1",
  })), /not allowed/);
  assert.equal(globalThis.__filterExploit, 0);
  delete globalThis.__filterExploit;
});
