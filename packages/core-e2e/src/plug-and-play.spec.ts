import { checkLicenses, UnsupportedProjectError } from "@license-cop/core";
import {
  createProject,
  LicenseFileBuilder,
  PackageJsonBuilder,
  type PackageManager,
  type Project
} from "@license-cop/e2e-fixtures";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

// Yarn 2+ defaults to Plug'n'Play: no node_modules at all, so scanning it would find nothing and
// pass. It must be refused instead. The project has a forbidden license (ISC, with only MIT
// allowed), so a wrongly passing check would be caught here too.
//
// The CLI's own behaviour for a Plug'n'Play project (exit code and message) is covered in
// cli-e2e, since it's the built binary's wiring, not the engine's.
describe.each<PackageManager>(["yarn-3", "yarn-4"])("%s with Plug'n'Play", packageManager => {
  let project: Project;

  beforeAll(async () => {
    const packageJson = new PackageJsonBuilder().dependsOn("usesIsc").overriding("isc");
    const licenseFile = new LicenseFileBuilder().allowingLicenses("MIT");

    project = await createProject({ packageManager, packageJson, licenseFile, linker: "pnp" });
  });

  afterAll(async () => {
    await project.remove();
  });

  it("should be refused by checkLicenses instead of passing", async () => {
    const act = checkLicenses({
      allowedLicenses: ["MIT"],
      allowedPackages: [],
      workingDirectory: project.path
    });

    await expect(act).rejects.toThrow(UnsupportedProjectError);
  });
});
