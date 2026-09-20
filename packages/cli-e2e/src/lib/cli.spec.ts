import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, realpath, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { cliBinPath } from "./fixtures";
import { LicenseFileBuilder } from "./license-file-builder";
import { PackageJsonBuilder } from "./package-json-builder";
import type { PackageManager } from "./package-managers";
import { createProject, type Project } from "./project";
import { runProcess } from "./run-process";

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

// Commands that need no install: they only prove the built binary starts, finds its own
// package.json (for the version) and writes to the filesystem.
describe("cli", () => {
  let directory: string;

  beforeAll(async () => {
    directory = await realpath(await mkdtemp(join(tmpdir(), "cli-e2e-bin-")));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  const runCli = (args: string[]) => runProcess("node", [cliBinPath, ...args], { cwd: directory });

  it("should print the installed version", async () => {
    const { exitCode, output } = await runCli(["--version"]);

    expect(exitCode).toBe(0);
    expect(output.trim()).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it("should print the usage", async () => {
    const { exitCode, output } = await runCli(["--help"]);

    expect(exitCode).toBe(0);
    expect(output).toContain("Usage: license-cop");
  });

  it("should exit 1 with a usage error for an unknown flag", async () => {
    const { exitCode, output } = await runCli(["--nope"]);

    expect(exitCode).toBe(1);
    expect(output).toContain("error:");
  });

  it("should write a config file when initialising", async () => {
    const { exitCode } = await runCli(["init"]);

    expect(exitCode).toBe(0);
    const config = await readFile(join(directory, ".licenses.json"), "utf8");
    expect(JSON.parse(config)).toHaveProperty("licenses");
  });
});
