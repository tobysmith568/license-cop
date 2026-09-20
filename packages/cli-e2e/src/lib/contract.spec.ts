import { checkLicenses, type CheckLicensesResult } from "@license-cop/core";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PackageJsonBuilder } from "./package-json-builder";
import { packageManagers } from "./package-managers";
import { createProject, type Project } from "./project";

// Not re-testing classification (that's the classifier's unit tests): just that each engine reads
// its package manager's real on-disk state into the right packages, versions, licenses and
// dev/prod split.
//
//   dependencies:    uses-isc (MIT)  ->  isc (ISC, transitive)
//   devDependencies: mit (MIT)
describe.each(packageManagers)("%s", packageManager => {
  let project: Project;

  beforeAll(async () => {
    const packageJson = new PackageJsonBuilder()
      .dependsOn("usesIsc")
      .devDependsOn("mit")
      .overriding("isc");

    project = await createProject({ packageManager, packageJson });
  });

  afterAll(async () => {
    await project.remove();
  });

  const check = (options: { includeDevDependencies?: boolean; devDependenciesOnly?: boolean }) =>
    checkLicenses({
      allowedLicenses: ["MIT"],
      allowedPackages: [],
      workingDirectory: project.path,
      ...options
    });

  it("should find direct and transitive production dependencies by default", async () => {
    const result = await check({});

    expect(namesAndVersions(result.allowedLicenses)).toEqual([
      "@license-cop/uses-isc-test-package@0.0.1"
    ]);
    expect(namesAndVersions(result.forbiddenLicenses)).toEqual([
      "@license-cop/isc-test-package@1.2.3"
    ]);
    expect(result.noLicenses.size).toBe(0);
  });

  it("should also find dev dependencies when including them", async () => {
    const result = await check({ includeDevDependencies: true });

    expect(namesAndVersions(result.allowedLicenses)).toEqual([
      "@license-cop/mit-test-package@4.5.6",
      "@license-cop/uses-isc-test-package@0.0.1"
    ]);
    expect(namesAndVersions(result.forbiddenLicenses)).toEqual([
      "@license-cop/isc-test-package@1.2.3"
    ]);
  });

  it("should only find dev dependencies when scanning dev dependencies only", async () => {
    const result = await check({ devDependenciesOnly: true });

    expect(namesAndVersions(result.allowedLicenses)).toEqual([
      "@license-cop/mit-test-package@4.5.6"
    ]);
    expect(result.forbiddenLicenses.size).toBe(0);
  });
});

const namesAndVersions = (packages: CheckLicensesResult[keyof CheckLicensesResult]) =>
  [...packages].map(pkg => `${pkg.name}@${pkg.version}`).sort();

// An optional dependency that got installed is shipped like any other, so it has to be checked.
// The forbidden license (only MIT is allowed) is what would go unnoticed if it were skipped.
//
//   dependencies:         mit (MIT)
//   optionalDependencies: isc (ISC)
describe.each(packageManagers)("%s with an optional dependency", packageManager => {
  let project: Project;

  beforeAll(async () => {
    const packageJson = new PackageJsonBuilder().dependsOn("mit").optionallyDependsOn("isc");

    project = await createProject({ packageManager, packageJson });
  });

  afterAll(async () => {
    await project.remove();
  });

  const check = (options: { includeDevDependencies?: boolean; devDependenciesOnly?: boolean }) =>
    checkLicenses({
      allowedLicenses: ["MIT"],
      allowedPackages: [],
      workingDirectory: project.path,
      ...options
    });

  it("should find it by default", async () => {
    const result = await check({});

    expect(namesAndVersions(result.allowedLicenses)).toEqual([
      "@license-cop/mit-test-package@4.5.6"
    ]);
    expect(namesAndVersions(result.forbiddenLicenses)).toEqual([
      "@license-cop/isc-test-package@1.2.3"
    ]);
  });

  it("should find it when including dev dependencies", async () => {
    const result = await check({ includeDevDependencies: true });

    expect(namesAndVersions(result.forbiddenLicenses)).toEqual([
      "@license-cop/isc-test-package@1.2.3"
    ]);
  });

  it("should not find it when scanning dev dependencies only", async () => {
    const result = await check({ devDependenciesOnly: true });

    expect(result.allowedLicenses.size).toBe(0);
    expect(result.forbiddenLicenses.size).toBe(0);
  });
});
