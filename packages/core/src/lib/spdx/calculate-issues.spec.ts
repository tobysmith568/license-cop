import { describe, expect, it } from "bun:test";
import { calculateIssues } from "./calculate-issues";
import { parseLicenseExpression } from "./parse-license-expression";
import type { SpdxExpression } from "./types/spdx-expression";

describe("calculateIssues", () => {
  const issuesFor = (expression: string, allowedLicenses: string[]) => {
    const parsed = parseLicenseExpression(expression) as SpdxExpression;
    return calculateIssues(parsed, allowedLicenses);
  };

  describe("identifiers", () => {
    it("should return no issues for an allowed license", () => {
      expect(issuesFor("MIT", ["MIT"])).toEqual([]);
    });

    it("should return the license when it isn't allowed", () => {
      expect(issuesFor("GPL-3.0", ["MIT"])).toEqual(["GPL-3.0"]);
    });

    it("should be case sensitive", () => {
      expect(issuesFor("mit", ["MIT"])).toEqual(["mit"]);
    });
  });

  describe("AND expressions", () => {
    it("should return no issues when both licenses are allowed", () => {
      expect(issuesFor("(MIT AND ISC)", ["MIT", "ISC"])).toEqual([]);
    });

    it("should return the license that isn't allowed", () => {
      expect(issuesFor("(MIT AND GPL-3.0)", ["MIT"])).toEqual(["GPL-3.0"]);
    });

    it("should return every license that isn't allowed", () => {
      expect(issuesFor("(GPL-2.0 AND GPL-3.0)", ["MIT"])).toEqual(["GPL-2.0", "GPL-3.0"]);
    });
  });

  describe("OR expressions", () => {
    it("should return no issues when both licenses are allowed", () => {
      expect(issuesFor("(MIT OR ISC)", ["MIT", "ISC"])).toEqual([]);
    });

    it("should return no issues when only the left license is allowed", () => {
      expect(issuesFor("(MIT OR GPL-3.0)", ["MIT"])).toEqual([]);
    });

    it("should return no issues when only the right license is allowed", () => {
      expect(issuesFor("(GPL-3.0 OR MIT)", ["MIT"])).toEqual([]);
    });

    it("should return every license when none are allowed", () => {
      expect(issuesFor("(GPL-2.0 OR GPL-3.0)", ["MIT"])).toEqual(["GPL-2.0", "GPL-3.0"]);
    });

    it("should return no issues when an OR is nested in an AND and each side has an allowed license", () => {
      expect(issuesFor("(MIT AND (GPL-3.0 OR ISC))", ["MIT", "ISC"])).toEqual([]);
    });

    it("should return the issues of a nested OR when the AND's other side is allowed but the OR has no allowed license", () => {
      expect(issuesFor("(MIT AND (GPL-2.0 OR GPL-3.0))", ["MIT"])).toEqual(["GPL-2.0", "GPL-3.0"]);
    });

    it("should return no issues when one side of an OR is allowed and the other is a partly-forbidden AND", () => {
      expect(issuesFor("(MIT OR (GPL-3.0 AND ISC))", ["MIT"])).toEqual([]);
    });
  });

  describe("WITH expressions", () => {
    it("should return no issues when the license and the full expression are both allowed", () => {
      const allowed = ["GPL-2.0", "GPL-2.0 WITH Classpath-exception-2.0"];

      expect(issuesFor("GPL-2.0 WITH Classpath-exception-2.0", allowed)).toEqual([]);
    });

    it("should return the whole expression when nothing is allowed", () => {
      expect(issuesFor("GPL-2.0 WITH Classpath-exception-2.0", ["MIT"])).toEqual([
        "GPL-2.0 WITH Classpath-exception-2.0"
      ]);
    });
  });
});
