export type FilterScalar = string | number | boolean | null;
export type FilterValue = FilterScalar | FilterScalar[];

export type ComparisonOperator =
  | "eq"
  | "neq"
  | "in"
  | "notIn"
  | "contains"
  | "startsWith"
  | "exists"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export type PokemonFilterField =
  | "id"
  | "name"
  | "types"
  | "primaryType"
  | "secondaryType"
  | "hasMultipleTypes";

export interface ComparisonExpression {
  field: PokemonFilterField;
  op: ComparisonOperator;
  value: FilterValue;
}

export type FilterExpression =
  | ComparisonExpression
  | { and: FilterExpression[] }
  | { or: FilterExpression[] }
  | { not: FilterExpression };

export interface FilterContractV1 {
  version: 1;
  where: FilterExpression;
}

export interface NamedFilter {
  id: string;
  name: string;
  contract: FilterContractV1;
  updatedAt: string;
}
