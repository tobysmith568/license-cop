import { getTokens } from "./get-tokens";
import { Token } from "./types/token";

const testCases: [string, Token[]][] = [
  ["MIT", [{ type: "identifier", value: "MIT" }]],
  [
    "(MIT OR Apache-2.0)",
    [
      { type: "parenthesis", value: "(" },
      { type: "identifier", value: "MIT" },
      { type: "operator", value: "OR" },
      { type: "identifier", value: "Apache-2.0" },
      { type: "parenthesis", value: ")" }
    ]
  ],
  [
    "(MIT AND Apache-2.0)",
    [
      { type: "parenthesis", value: "(" },
      { type: "identifier", value: "MIT" },
      { type: "operator", value: "AND" },
      { type: "identifier", value: "Apache-2.0" },
      { type: "parenthesis", value: ")" }
    ]
  ],
  [
    "(Apache-2.0 WITH Bison-exception-2.2)",
    [
      { type: "parenthesis", value: "(" },
      { type: "identifier", value: "Apache-2.0" },
      { type: "with" },
      { type: "identifier", value: "Bison-exception-2.2" },
      { type: "parenthesis", value: ")" }
    ]
  ],
  [
    "(MIT AND (Apache-2.0 OR BSD-3-Clause))",
    [
      { type: "parenthesis", value: "(" },
      { type: "identifier", value: "MIT" },
      { type: "operator", value: "AND" },
      { type: "parenthesis", value: "(" },
      { type: "identifier", value: "Apache-2.0" },
      { type: "operator", value: "OR" },
      { type: "identifier", value: "BSD-3-Clause" },
      { type: "parenthesis", value: ")" },
      { type: "parenthesis", value: ")" }
    ]
  ],
  [
    "(MIT OR (GPL-3.0-only WITH Bison-exception-2.2))",
    [
      { type: "parenthesis", value: "(" },
      { type: "identifier", value: "MIT" },
      { type: "operator", value: "OR" },
      { type: "parenthesis", value: "(" },
      { type: "identifier", value: "GPL-3.0-only" },
      { type: "with" },
      { type: "identifier", value: "Bison-exception-2.2" },
      { type: "parenthesis", value: ")" },
      { type: "parenthesis", value: ")" }
    ]
  ]
];

describe("getTokens", () => {
  it.each(testCases)("should get the tokens for the expression: %s", (expression, expected) => {
    const result = getTokens(expression);

    expect(result).toEqual(expected);
  });
});
