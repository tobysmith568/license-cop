import { describe, expect, it } from "bun:test";
import { PackageJson, type PackageJsonData } from "./package-json";

describe("PackageJson", () => {
  describe("licenseExpression", () => {
    const packageJson = (extra: Partial<PackageJsonData>): PackageJson =>
      new PackageJson({ name: "test", version: "1.0.0", ...extra });

    it("should return a string license as-is", () => {
      const result = packageJson({ license: "MIT" }).licenseExpression;

      expect(result).toBe("MIT");
    });

    it("should return the type of an object license", () => {
      const result = packageJson({ license: { type: "ISC" } }).licenseExpression;

      expect(result).toBe("ISC");
    });

    it("should return the only entry of the licenses array", () => {
      const result = packageJson({ licenses: [{ type: "MIT" }] }).licenseExpression;

      expect(result).toBe("MIT");
    });

    it("should AND together multiple entries of the licenses array", () => {
      const licenses = [{ type: "MIT" }, { type: "ISC" }, { type: "Apache-2.0" }];

      const result = packageJson({ licenses }).licenseExpression;

      expect(result).toBe("(MIT AND ISC AND Apache-2.0)");
    });

    it("should prefer license over licenses", () => {
      const result = packageJson({ license: "MIT", licenses: [{ type: "ISC" }] }).licenseExpression;

      expect(result).toBe("MIT");
    });

    it("should return UNLICENSED when there is no license information", () => {
      const result = packageJson({}).licenseExpression;

      expect(result).toBe("UNLICENSED");
    });

    it("should return UNLICENSED for an empty license string", () => {
      const result = packageJson({ license: "" }).licenseExpression;

      expect(result).toBe("UNLICENSED");
    });

    it("should return UNLICENSED for an empty licenses array", () => {
      const result = packageJson({ licenses: [] }).licenseExpression;

      expect(result).toBe("UNLICENSED");
    });
  });
});
