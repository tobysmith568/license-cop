import type { PackageManager } from "@license-cop/e2e-fixtures";
import { LicenseFileBuilder, PackageJsonBuilder } from "@license-cop/e2e-fixtures";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createProject, type Project } from "./project";

// Yarn 2+ defaults to Plug'n'Play: no node_modules at all, so scanning it would find nothing and
// pass. The engine refusing it (`UnsupportedProjectError`) is covered in core-e2e; this only checks
// that the built CLI reports it correctly, with exit 1 and the right explanation.
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

  it("should exit 1 and explain in the built CLI", async () => {
    const { exitCode, output } = await project.runCli();

    expect(exitCode).toBe(1);
    expect(output).toContain("Plug'n'Play");
    expect(output).toContain("nodeLinker: node-modules");
  });
});
