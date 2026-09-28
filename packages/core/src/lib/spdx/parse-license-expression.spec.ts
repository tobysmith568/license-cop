import { describe, expect, it } from "bun:test";
import { parseLicenseExpression } from "./parse-license-expression";

describe("parseLicenseExpression", () => {
  it("should return unlicensed for UNLICENSED", () => {
    expect(parseLicenseExpression("UNLICENSED")).toEqual({ type: "unlicensed" });
  });

  it("should parse a single identifier", () => {
    expect(parseLicenseExpression("MIT")).toEqual({ type: "identifier", value: "MIT" });
  });

  it("should parse a compound expression", () => {
    expect(parseLicenseExpression("(MIT OR ISC)")).toEqual({
      type: "OR",
      expressions: [
        { type: "identifier", value: "MIT" },
        { type: "identifier", value: "ISC" }
      ]
    });
  });

  it("should parse a WITH expression", () => {
    expect(parseLicenseExpression("GPL-2.0 WITH Classpath-exception-2.0")).toEqual({
      type: "WITH",
      expressions: ["GPL-2.0", "Classpath-exception-2.0"]
    });
  });

  it("should throw for an invalid expression", () => {
    expect(() => parseLicenseExpression("(MIT")).toThrow();
  });
});
