import { checkLicenses, UnsupportedProjectError } from "@license-cop/core";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { LicenseFileBuilder } from "./license-file-builder";
import { PackageJsonBuilder } from "./package-json-builder";
import type { PackageManager } from "./package-managers";
import { createProject, type Project } from "./project";

// Yarn 2+ defaults to Plug'n'Play: no node_modules at all, so scanning it would find nothing and
// pass. It must be refused instead. The project has a forbidden license (ISC, with only MIT
// allowed), so a wrongly passing check would be caught here too.
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

  it("should exit 1 and explain in the built CLI", async () => {
    const { exitCode, output } = await project.runCli();

    expect(exitCode).toBe(1);
    expect(output).toContain("Plug'n'Play");
    expect(output).toContain("nodeLinker: node-modules");
  });
});
