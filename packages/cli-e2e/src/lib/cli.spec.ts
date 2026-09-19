import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { LicenseFileBuilder } from "./license-file-builder";
import { PackageJsonBuilder } from "./package-json-builder";
import type { PackageManager } from "./package-managers";
import { createProject, type Project } from "./project";

// The built CLI binary against a real install: args parsed -> config loaded -> engine invoked ->
// report printed -> exit code. Just confirming the pieces wire together, one project per engine
// (npm and pnpm are the two distinct engines). Scenarios live in the unit and contract tests.
describe.each<PackageManager>(["npm", "pnpm"])("cli with %s", packageManager => {
  let project: Project;

  beforeAll(async () => {
    const packageJson = new PackageJsonBuilder().dependsOn("usesIsc").overriding("isc");
    const licenseFile = new LicenseFileBuilder().allowingLicenses("MIT");

    project = await createProject({ packageManager, packageJson, licenseFile });
  });

  afterAll(async () => {
    await project.remove();
  });

  it("should exit 1 and report the forbidden license when a license isn't allowed", async () => {
    const { exitCode, output } = await project.runCli();

    expect(exitCode).toBe(1);
    expect(output).toContain("@license-cop/isc-test-package@1.2.3");
  });

  it("should exit 0 when every license is allowed", async () => {
    await project.writeLicenseFile(new LicenseFileBuilder().allowingLicenses("MIT", "ISC"));

    const { exitCode } = await project.runCli();

    expect(exitCode).toBe(0);
  });
});
