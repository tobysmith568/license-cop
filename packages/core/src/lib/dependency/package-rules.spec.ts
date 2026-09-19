import { describe, expect, it } from "bun:test";
import { isAllowedPackage } from "./package-rules";

describe("PackageRules", () => {
  describe("isAllowedPackage", () => {
    const packageName = "react";
    const packageMajorVersion = "16";
    const packageMinorVersion = "13";
    const packagePatchVersion = "1";
    const packageVersion = `${packageMajorVersion}.${packageMinorVersion}.${packagePatchVersion}`;

    it("should return true if the package is in the allowed list without a version", () => {
      const allowedPackages = ["something", packageName, "something else"];

      const result = isAllowedPackage(packageName, packageVersion, allowedPackages);

      expect(result).toBeTruthy();
    });

    it("should return true if the package is in the allowed list with its exact version", () => {
      const allowedPackages = ["something", `${packageName}@${packageVersion}`, "something else"];

      const result = isAllowedPackage(packageName, packageVersion, allowedPackages);

      expect(result).toBeTruthy();
    });

    it("should return true if the package is in the allowed list with a ^ and its major version", () => {
      const version = `^${packageMajorVersion}.0.0`;

      const allowedPackages = ["something", packageName + "@" + version, "something else"];

      const result = isAllowedPackage(packageName, packageVersion, allowedPackages);

      expect(result).toBeTruthy();
    });

    it("should return true if the package is in the allowed list with a ~ and its major and minor versions", () => {
      const version = `~${packageMajorVersion}.${packageMinorVersion}.0`;

      const allowedPackages = ["something", packageName + "@" + version, "something else"];

      const result = isAllowedPackage(packageName, packageVersion, allowedPackages);

      expect(result).toBeTruthy();
    });

    it("should return true if the package's version is within an allowed range", () => {
      const allowedPackages = [`${packageName}@<${Number(packageMajorVersion) + 1}.0.0`];

      const result = isAllowedPackage(packageName, packageVersion, allowedPackages);

      expect(result).toBeTruthy();
    });

    it("should return false if the package's version is outside an allowed range", () => {
      const allowedPackages = [`${packageName}@<${packageMajorVersion}.${packageMinorVersion}`];

      const result = isAllowedPackage(packageName, packageVersion, allowedPackages);

      expect(result).toBeFalsy();
    });

    it("should return false if the package is in the allowed list with a ^ and a greater minor version", () => {
      const version = `^${packageMajorVersion}.${Number(packageMinorVersion) + 1}.0`;
      const allowedPackages = [`${packageName}@${version}`];

      const result = isAllowedPackage(packageName, packageVersion, allowedPackages);

      expect(result).toBeFalsy();
    });

    it("should return false if the package is in the allowed list with a ~ and a greater patch version", () => {
      const version = `~${packageMajorVersion}.${packageMinorVersion}.${Number(packagePatchVersion) + 1}`;
      const allowedPackages = [`${packageName}@${version}`];

      const result = isAllowedPackage(packageName, packageVersion, allowedPackages);

      expect(result).toBeFalsy();
    });

    it("should return false if the package is not in the allowed list", () => {
      const allowedPackages = ["something", "something else"];

      const result = isAllowedPackage(packageName, packageVersion, allowedPackages);

      expect(result).toBeFalsy();
    });

    it("should return false if the package is in the allowed list with a version that does not match", () => {
      const version = `${packageMajorVersion + 1}.0.0`;
      const allowedPackages = ["something", `${packageName}@${version}`, "something else"];

      const result = isAllowedPackage(packageName, packageVersion, allowedPackages);

      expect(result).toBeFalsy();
    });
  });
});
