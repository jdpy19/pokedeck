export const FILTER_VERSION = 1;
export const MAX_FILTER_DEPTH = 6;
export const MAX_FILTER_NODES = 80;

const common = ["eq", "neq", "in", "notIn", "exists"];
const FIELD_RULES = Object.freeze({
  id: { kind: "number", ops: [...common, "gt", "gte", "lt", "lte"] },
  name: { kind: "string", ops: [...common, "contains", "startsWith"] },
  types: { kind: "stringArray", ops: [...common, "contains"] },
  primaryType: { kind: "string", ops: [...common, "contains", "startsWith"] },
  secondaryType: { kind: "nullableString", ops: [...common, "contains", "startsWith"] },
  hasMultipleTypes: { kind: "boolean", ops: [...common] },
});

export class FilterValidationError extends Error {
  constructor(message, path = "filter") {
    super(`${path}: ${message}`);
    this.name = "FilterValidationError";
  }
}

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

function assertKeys(object, allowed, path) {
  const extras = Object.keys(object).filter((key) => !allowed.includes(key));
  if (extras.length) throw new FilterValidationError(`unsupported key “${extras[0]}”`, path);
}

function scalarMatches(kind, value) {
  if (value === null) return kind === "nullableString";
  if (kind === "number") return typeof value === "number" && Number.isFinite(value);
  if (kind === "boolean") return typeof value === "boolean";
  return typeof value === "string" && value.length <= 100;
}

function validateValue(rule, op, value, path) {
  if (op === "exists") {
    if (typeof value !== "boolean") throw new FilterValidationError("exists requires a boolean", path);
    return value;
  }
  if (op === "in" || op === "notIn") {
    if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
      throw new FilterValidationError(`${op} requires 1–50 values`, path);
    }
    const itemKind = rule.kind === "stringArray" ? "string" : rule.kind;
    if (!value.every((item) => scalarMatches(itemKind, item))) {
      throw new FilterValidationError(`${op} contains a value of the wrong type`, path);
    }
    return value.slice();
  }
  if (Array.isArray(value)) throw new FilterValidationError(`${op} does not accept an array`, path);
  const valueKind = rule.kind === "stringArray" ? "string" : rule.kind;
  if (!scalarMatches(valueKind, value)) {
    throw new FilterValidationError(`value is invalid for this field`, path);
  }
  if (["contains", "startsWith", "gt", "gte", "lt", "lte"].includes(op) && value === null) {
    throw new FilterValidationError(`${op} does not accept null`, path);
  }
  return value;
}

export function validateFilterContract(input) {
  if (!isPlainObject(input)) throw new FilterValidationError("must be an object");
  assertKeys(input, ["version", "where"], "filter");
  if (input.version !== FILTER_VERSION) {
    throw new FilterValidationError(`unsupported version “${String(input.version)}”`, "filter.version");
  }
  let nodes = 0;
  function visit(expression, depth, path) {
    nodes += 1;
    if (nodes > MAX_FILTER_NODES) throw new FilterValidationError(`exceeds ${MAX_FILTER_NODES} nodes`, path);
    if (depth > MAX_FILTER_DEPTH) throw new FilterValidationError(`exceeds maximum depth ${MAX_FILTER_DEPTH}`, path);
    if (!isPlainObject(expression)) throw new FilterValidationError("must be an object", path);
    const logical = ["and", "or", "not"].filter((key) => Object.hasOwn(expression, key));
    if (logical.length) {
      if (logical.length !== 1 || Object.keys(expression).length !== 1) {
        throw new FilterValidationError("must contain exactly one logical operator", path);
      }
      const operator = logical[0];
      if (operator === "not") return { not: visit(expression.not, depth + 1, `${path}.not`) };
      const children = expression[operator];
      if (!Array.isArray(children) || children.length === 0) {
        throw new FilterValidationError(`${operator} requires a non-empty array`, path);
      }
      return { [operator]: children.map((child, index) => visit(child, depth + 1, `${path}.${operator}[${index}]`)) };
    }
    assertKeys(expression, ["field", "op", "value"], path);
    if (!Object.hasOwn(expression, "field") || !Object.hasOwn(expression, "op") || !Object.hasOwn(expression, "value")) {
      throw new FilterValidationError("comparison requires field, op, and value", path);
    }
    if (!Object.hasOwn(FIELD_RULES, expression.field)) {
      throw new FilterValidationError(`field “${String(expression.field)}” is not allowed`, `${path}.field`);
    }
    const rule = FIELD_RULES[expression.field];
    if (!rule.ops.includes(expression.op)) {
      throw new FilterValidationError(`operator “${String(expression.op)}” is not allowed for ${expression.field}`, `${path}.op`);
    }
    return {
      field: expression.field,
      op: expression.op,
      value: validateValue(rule, expression.op, expression.value, `${path}.value`),
    };
  }
  if (!Object.hasOwn(input, "where")) throw new FilterValidationError("where is required");
  return { version: FILTER_VERSION, where: visit(input.where, 1, "filter.where") };
}

const normalizeString = (value) => typeof value === "string" ? value.toLocaleLowerCase() : value;
const same = (left, right) => {
  if (typeof left === "string" && typeof right === "string") return normalizeString(left) === normalizeString(right);
  if (Array.isArray(left)) return left.some((item) => same(item, right));
  return left === right;
};

function compileComparison({ field, op, value }) {
  const expected = Array.isArray(value) ? value.map(normalizeString) : normalizeString(value);
  return (record) => {
    const present = Object.hasOwn(record, field);
    const actual = present ? record[field] : undefined;
    if (op === "exists") return value ? present && actual !== null : !present || actual === null;
    if (!present) return false;
    if (op === "eq") return same(actual, expected);
    if (op === "neq") return !same(actual, expected);
    if (op === "in" || op === "notIn") {
      const match = Array.isArray(actual)
        ? actual.some((item) => expected.some((candidate) => same(item, candidate)))
        : expected.some((candidate) => same(actual, candidate));
      return op === "in" ? match : !match;
    }
    if (actual === null) return false;
    if (op === "contains") {
      if (Array.isArray(actual)) return actual.some((item) => same(item, expected));
      return normalizeString(actual).includes(expected);
    }
    if (op === "startsWith") return normalizeString(actual).startsWith(expected);
    if (op === "gt") return actual > expected;
    if (op === "gte") return actual >= expected;
    if (op === "lt") return actual < expected;
    if (op === "lte") return actual <= expected;
    return false;
  };
}

export function compileFilter(input) {
  const contract = validateFilterContract(input);
  function compile(expression) {
    if (expression.and) {
      const children = expression.and.map(compile);
      return (record) => children.every((predicate) => predicate(record));
    }
    if (expression.or) {
      const children = expression.or.map(compile);
      return (record) => children.some((predicate) => predicate(record));
    }
    if (expression.not) {
      const child = compile(expression.not);
      return (record) => !child(record);
    }
    return compileComparison(expression);
  }
  return compile(contract.where);
}
