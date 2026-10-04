import { checkLicenses, NotInstalledError, type CheckLicensesResult } from "@license-cop/core";
import {
  createProject,
  PackageJsonBuilder,
  packageManagers,
  type PackageManager,
  type Project
} from "@license-cop/e2e-fixtures";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

// A workspace root with three members, none of which has a license of its own (like most real
// ones, since they're the project's own code rather than dependencies of it):
//
//   packages/a  dependencies: mit (MIT)
//   packages/b  dependencies: isc (ISC)
//   packages/c  dependencies: member a
const createWorkspace = (packageManager: PackageManager) =>
  createProject({
    packageManager,
    packageJson: new PackageJsonBuilder(),
    members: {
      a: new PackageJsonBuilder().dependsOn("mit"),
      b: new PackageJsonBuilder().dependsOn("isc"),
      c: new PackageJsonBuilder().dependsOnMember("a")
    }
  });

// pnpm and bun's isolated linker give each member its own node_modules (a symlink farm into a
// central store), so scanning one on its own works; npm, yarn and bun's hoisted linker hoist
// everything to the root instead, leaving a member with nothing installed to scan on its own.
const givesEachMemberOwnNodeModules = (packageManager: PackageManager) =>
  packageManager.startsWith("pnpm") || packageManager === "bun-1-isolated";

const check = (workingDirectory: string) =>
  checkLicenses({ allowedLicenses: ["MIT"], allowedPackages: [], workingDirectory });

// `c` links to `a`, which must be seen as the project's own code rather than a dependency
describe.each([...packageManagers])("%s workspace root", packageManager => {
  let project: Project;

  beforeAll(async () => {
    project = await createWorkspace(packageManager);
  });

  afterAll(async () => {
    await project.remove();
  });

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

describe.each(packageManagers.filter(givesEachMemberOwnNodeModules))(
  "%s workspace member",
  packageManager => {
    let project: Project;

    beforeAll(async () => {
      project = await createWorkspace(packageManager);
    });

    afterAll(async () => {
      await project.remove();
    });

    it("should find the member's dependencies", async () => {
      const result = await check(project.memberPath("a"));

      expect(namesAndVersions(result.allowedLicenses)).toEqual([
        "@license-cop/mit-test-package@4.5.6"
      ]);
    });
  }
);

describe.each(packageManagers.filter(name => !givesEachMemberOwnNodeModules(name)))(
  "%s workspace member",
  packageManager => {
    let project: Project;

    beforeAll(async () => {
      project = await createWorkspace(packageManager);
    });

    afterAll(async () => {
      await project.remove();
    });

    it("should be refused, pointing at the workspace root", async () => {
      const act = check(project.memberPath("a"));

      await expect(act).rejects.toThrow(NotInstalledError);
      await expect(act).rejects.toThrow("workspace root");
    });
  }
);

const namesAndVersions = (packages: CheckLicensesResult[keyof CheckLicensesResult]) =>
  [...packages].map(pkg => `${pkg.name}@${pkg.version}`).sort();
