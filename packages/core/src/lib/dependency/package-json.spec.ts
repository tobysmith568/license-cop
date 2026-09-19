import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createTempDir, type TempDir } from "../test-utils/temp-dir";
import { getLicenseExpression, readPackageJson, type PackageJson } from "./package-json";

describe("PackageJson", () => {
  describe("getLicenseExpression", () => {
    const packageJson = (extra: Partial<PackageJson>): PackageJson => ({
      name: "test",
      version: "1.0.0",
      ...extra
    });

    it("should return a string license as-is", () => {
      const result = getLicenseExpression(packageJson({ license: "MIT" }));

      expect(result).toBe("MIT");
    });

    it("should return the type of an object license", () => {
      const result = getLicenseExpression(packageJson({ license: { type: "ISC" } }));

      expect(result).toBe("ISC");
    });

    it("should return the only entry of the licenses array", () => {
      const result = getLicenseExpression(packageJson({ licenses: [{ type: "MIT" }] }));

      expect(result).toBe("MIT");
    });

    it("should AND together multiple entries of the licenses array", () => {
      const licenses = [{ type: "MIT" }, { type: "ISC" }, { type: "Apache-2.0" }];

      const result = getLicenseExpression(packageJson({ licenses }));

      expect(result).toBe("(MIT AND ISC AND Apache-2.0)");
    });

    it("should prefer license over licenses", () => {
      const result = getLicenseExpression(
        packageJson({ license: "MIT", licenses: [{ type: "ISC" }] })
      );

      expect(result).toBe("MIT");
    });

    it("should return UNLICENSED when there is no license information", () => {
      const result = getLicenseExpression(packageJson({}));

      expect(result).toBe("UNLICENSED");
    });

    it("should return UNLICENSED for an empty license string", () => {
      const result = getLicenseExpression(packageJson({ license: "" }));

      expect(result).toBe("UNLICENSED");
    });

    it("should return UNLICENSED for an empty licenses array", () => {
      const result = getLicenseExpression(packageJson({ licenses: [] }));

      expect(result).toBe("UNLICENSED");
    });
  });

  describe("readPackageJson", () => {
    let dir: TempDir;

    beforeEach(async () => {
      dir = await createTempDir();
    });

    afterEach(async () => {
      await dir.remove();
    });

    it("should read a valid package.json", async () => {
      await dir.write({ "package.json": { name: "test", version: "1.2.3", license: "MIT" } });

      const result = await readPackageJson(`${dir.path}/package.json`);

      expect(result).toEqual({ name: "test", version: "1.2.3", license: "MIT" });
    });

    it("should read a package.json containing comments and trailing commas", async () => {
      await dir.write({
        "package.json": `{
          // a comment
          "name": "test",
          "version": "1.2.3",
        }`
      });

      const result = await readPackageJson(`${dir.path}/package.json`);

      expect(result.name).toBe("test");
    });

    it("should throw when the file doesn't exist", async () => {
      const messages: string[] = [];

      const act = readPackageJson(`${dir.path}/package.json`, message => messages.push(message));

      await expect(act).rejects.toThrow("Cannot find the file");
      expect(messages).toHaveLength(1);
    });

    it("should throw when the path is a directory", async () => {
      await dir.write({ "package.json/inner.txt": "" });

      const act = readPackageJson(`${dir.path}/package.json`);

      await expect(act).rejects.toThrow("Cannot find the file");
    });

    it("should throw when the file isn't valid JSON", async () => {
      await dir.write({ "package.json": "not json" });

      const act = readPackageJson(`${dir.path}/package.json`);

      await expect(act).rejects.toThrow();
    });

    it("should throw a helpful error when the package.json doesn't match the schema", async () => {
      await dir.write({ "package.json": { name: "test", version: 1 } });

      const act = readPackageJson(`${dir.path}/package.json`);

      await expect(act).rejects.toThrow("Unable to parse package.json");
    });
  });
});
