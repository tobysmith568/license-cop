import { checkLicenses, NotInstalledError, type CheckLicensesResult } from "@license-cop/core";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PackageJsonBuilder } from "./package-json-builder";
import { packageManagers, type PackageManager } from "./package-managers";
import { createProject, type Project } from "./project";

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

const isPnpm = (packageManager: PackageManager) => packageManager.startsWith("pnpm");

const check = (workingDirectory: string) =>
  checkLicenses({ allowedLicenses: ["MIT"], allowedPackages: [], workingDirectory });

// `c` links to `a`, which must be seen as the project's own code rather than a dependency
describe.each(packageManagers)("%s workspace root", packageManager => {
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

// pnpm gives each member its own node_modules, so scanning one on its own works
describe.each(packageManagers.filter(isPnpm))("%s workspace member", packageManager => {
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
});

// npm and yarn hoist everything to the root, leaving a member with nothing installed to scan, which
// has to be refused rather than passed
describe.each(packageManagers.filter(name => !isPnpm(name)))(
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
