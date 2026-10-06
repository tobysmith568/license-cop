import { checkLicenses, type CheckLicensesResult } from "@license-cop/core";
import {
  createProject,
  PackageJsonBuilder,
  type PackageManager,
  type Project
} from "@license-cop/e2e-fixtures";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { rm, stat } from "fs/promises";
import { join } from "path";

// The shapes of a Plug'n'Play install that the contract fixture doesn't reach. What a plain one
// reads (names, versions, licenses, the dev/prod split) is in contract.spec.ts, and workspaces are
// in workspaces.spec.ts, as every package manager is.
//
//   dependencies: uses-isc (MIT)  ->  isc (ISC, transitive)
describe.each<PackageManager>(["yarn-3-pnp", "yarn-4-pnp"])("%s", packageManager => {
  const check = (project: Project) =>
    checkLicenses({
      allowedLicenses: ["MIT"],
      allowedPackages: [],
      workingDirectory: project.path
    });

  describe("with an unplugged package", () => {
    let project: Project;

    beforeAll(async () => {
      const packageJson = new PackageJsonBuilder()
        .dependsOn("usesIsc")
        .unplugging("usesIsc")
        .overriding("isc");

      project = await createProject({ packageManager, packageJson });
    });

    afterAll(async () => {
      await project.remove();
    });

    it("should have been installed outside a zip, or this tests nothing", async () => {
      const stats = await stat(join(project.path, ".yarn", "unplugged"));

      expect(stats.isDirectory()).toBe(true);
    });

    it("should still find it and what it depends on", async () => {
      const result = await check(project);

      expect(namesAndVersions(result.allowedLicenses)).toEqual([
        "@license-cop/uses-isc-test-package@0.0.1"
      ]);
      expect(namesAndVersions(result.forbiddenLicenses)).toEqual([
        "@license-cop/isc-test-package@1.2.3"
      ]);
    });
  });

  // A zero-install repository commits its cache and `.pnp.cjs` and never runs an install, so the
  // state `yarn install` leaves behind isn't there. Reading must only need the files that are.
  describe("without the install state", () => {
    let project: Project;

    beforeAll(async () => {
      const packageJson = new PackageJsonBuilder().dependsOn("usesIsc").overriding("isc");

      project = await createProject({ packageManager, packageJson });

      await rm(join(project.path, ".yarn", "install-state.gz"), { force: true });
    });

    afterAll(async () => {
      await project.remove();
    });

    it("should still find the dependencies", async () => {
      const result = await check(project);

      expect(namesAndVersions(result.forbiddenLicenses)).toEqual([
        "@license-cop/isc-test-package@1.2.3"
      ]);
    });
  });
});

const namesAndVersions = (packages: CheckLicensesResult[keyof CheckLicensesResult]) =>
  [...packages].map(pkg => `${pkg.name}@${pkg.version}`).sort();
