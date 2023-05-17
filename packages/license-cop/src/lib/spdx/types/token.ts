// Operators

const operators = ["AND", "OR"] as const;
export const isOperator = (value: string): value is Operator =>
  operators.includes(value as Operator);

export type Operator = (typeof operators)[number];
export type OperatorToken = {
  type: "operator";
  value: Operator;
};

// With

export type WithToken = {
  type: "with";
};

// Identifiers

export type IdentifierToken = {
  type: "identifier";
  value: string;
};

// Parenthesis

const parenthesis = ["(", ")"] as const;
export const isParenthesis = (value: string): value is Parenthesis =>
  parenthesis.includes(value as Parenthesis);

export type Parenthesis = (typeof parenthesis)[number];
export type ParenthesisToken = {
  type: "parenthesis";
  value: Parenthesis;
};

export type Token = OperatorToken | WithToken | IdentifierToken | ParenthesisToken;
