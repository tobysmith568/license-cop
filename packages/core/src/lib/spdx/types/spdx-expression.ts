export type Identifier = {
  type: "identifier";
  value: string;
};

export type AndExpression = {
  type: "AND";
  expressions: [SpdxExpression, SpdxExpression];
};

export type OrExpression = {
  type: "OR";
  expressions: [SpdxExpression, SpdxExpression];
};

export type WithExpression = {
  type: "WITH";
  expressions: [string, string];
};

export type SpdxExpression = Identifier | AndExpression | OrExpression | WithExpression;

export type Unlicensed = {
  type: "unlicensed";
};
