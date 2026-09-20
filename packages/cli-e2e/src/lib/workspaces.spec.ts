import { checkLicenses, type CheckLicensesResult } from "@license-cop/core";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PackageJsonBuilder } from "./package-json-builder";
import { packageManagers } from "./package-managers";
import { createProject, type Project } from "./project";

// A workspace root with two members, neither of which has a license of its own (like most real
// ones, since they're the project's own code rather than dependencies of it):
//
//   packages/a  dependencies: mit (MIT)
//   packages/b  dependencies: isc (ISC)
//   packages/c  dependencies: member a
describe.each(packageManagers)("%s workspaces", packageManager => {
  let project: Project;

  beforeAll(async () => {
    project = await createProject({
      packageManager,
      packageJson: new PackageJsonBuilder(),
      members: {
        a: new PackageJsonBuilder().dependsOn("mit"),
        b: new PackageJsonBuilder().dependsOn("isc"),
        c: new PackageJsonBuilder().dependsOnMember("a")
      }
    });
  });

  afterAll(async () => {
    await project.remove();
  });

  const check = (workingDirectory: string) =>
    checkLicenses({ allowedLicenses: ["MIT"], allowedPackages: [], workingDirectory });

  // `c` links to `a`, which must be seen as the project's own code rather than a dependency
  describe("scanning the workspace root", () => {
    it("should find the dependencies of every member", async () => {
      const result = await check(project.path);

      expect(namesAndVersions(result.allowedLicenses)).toEqual([
        "@license-cop/mit-test-package@4.5.6"
      ]);
      expect(namesAndVersions(result.forbiddenLicenses)).toEqual([
        "@license-cop/isc-test-package@1.2.3"
      ]);
    });

    it("should not report the members themselves", async () => {
      const result = await check(project.path);

      expect(result.noLicenses.size).toBe(0);
    });
  });
});

const namesAndVersions = (packages: CheckLicensesResult[keyof CheckLicensesResult]) =>
  [...packages].map(pkg => `${pkg.name}@${pkg.version}`).sort();
