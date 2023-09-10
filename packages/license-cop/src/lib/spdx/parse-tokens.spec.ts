import { getTokens } from "./get-tokens";
import { parseTokens } from "./parse-tokens";
import { SpdxExpression } from "./types/spdx-expression";

const happyPathTestCases: [string, SpdxExpression][] = [
  ["MIT", { type: "identifier", value: "MIT" }],
  ["(MIT)", { type: "identifier", value: "MIT" }],
  [
    "(MIT OR ISC)",
    {
      type: "OR",
      expressions: [
        { type: "identifier", value: "MIT" },
        { type: "identifier", value: "ISC" }
      ]
    }
  ],
  [
    "(MIT AND Apache-2.0 AND ISC)",
    {
      type: "AND",
      expressions: [
        { type: "identifier", value: "MIT" },
        {
          type: "AND",
          expressions: [
            { type: "identifier", value: "Apache-2.0" },
            { type: "identifier", value: "ISC" }
          ]
        }
      ]
    }
  ],
  [
    // Note the order of precedence here - the `AND` is evaluated first
    "(MIT OR Apache-2.0 AND ISC)",
    {
      type: "OR",
      expressions: [
        { type: "identifier", value: "MIT" },
        {
          type: "AND",
          expressions: [
            { type: "identifier", value: "Apache-2.0" },
            { type: "identifier", value: "ISC" }
          ]
        }
      ]
    }
  ],
  [
    // Note the order of precedence here - the `WITH` is evaluated first
    "(MIT AND GPL-3.0-only WITH Bison-exception-2.2)",
    {
      type: "AND",
      expressions: [
        { type: "identifier", value: "MIT" },
        {
          type: "WITH",
          expressions: ["GPL-3.0-only", "Bison-exception-2.2"]
        }
      ]
    }
  ],
  [
    "(MIT OR (Apache-2.0 AND ISC))",
    {
      type: "OR",
      expressions: [
        { type: "identifier", value: "MIT" },
        {
          type: "AND",
          expressions: [
            { type: "identifier", value: "Apache-2.0" },
            { type: "identifier", value: "ISC" }
          ]
        }
      ]
    }
  ],
  [
    "((MIT OR Apache-2.0) AND ISC)",
    {
      type: "AND",
      expressions: [
        {
          type: "OR",
          expressions: [
            { type: "identifier", value: "MIT" },
            { type: "identifier", value: "Apache-2.0" }
          ]
        },
        { type: "identifier", value: "ISC" }
      ]
    }
  ]
];

const unhappyPathTestCases: string[] = [
  "(MIT OR)",
  "(MIT AND)",
  "(MIT WITH)",
  "(OR MIT)",
  "(AND MIT)",
  "(WITH MIT)",
  "(",
  ")",
  "()",
  "(MIT OR ISC",
  "MIT OR ISC)",
  "(MIT OR OR ISC)"
];

describe("parse-tokens", () => {
  it.each(happyPathTestCases)("should parse the expression: %s", (expression, expectedResult) => {
    const tokens = getTokens(expression);

    const result = parseTokens(tokens, expression);

    expect(result).toEqual(expectedResult);
  });

  it.each(unhappyPathTestCases)(
    "should throw an error when parsing the expression: %s",
    expression => {
      const tokens = getTokens(expression);

      expect(() => parseTokens(tokens, expression)).toThrow(
        `'${expression}' is not a valid SPDX expression`
      );
    }
  );
});
