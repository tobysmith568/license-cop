import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile } from "fs/promises";
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
describe.each<PackageManager>(["npm", "pnpm-10"])("cli with %s", packageManager => {
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
  let tempDir: TempDir;
  let directory: string;

  beforeAll(async () => {
    tempDir = await createTempDir({ prefix: "cli-e2e-bin-" });
    directory = tempDir.path;
  });

  afterAll(async () => {
    await tempDir.remove();
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

  it("should explain, without a stack trace, when the directory doesn't exist", async () => {
    const missing = join(directory, "missing");

    const { exitCode, output } = await runCli(["init", "--directory", missing]);

    expect(exitCode).toBe(1);
    expect(output).toContain("isn't a directory that exists");
    expect(output).not.toContain("    at ");
  });

  it("should write a config file when initialising", async () => {
    const { exitCode } = await runCli(["init"]);

    expect(exitCode).toBe(0);
    const config = await readFile(join(directory, ".licenses.json"), "utf8");
    expect(JSON.parse(config)).toHaveProperty("licenses");
  });

  it("should refuse to initialise again, leaving the config it made alone", async () => {
    const before = await readFile(join(directory, ".licenses.json"), "utf8");

    const { exitCode, output } = await runCli(["init"]);

    expect(exitCode).toBe(1);
    expect(output).toContain("already has a config file");
    const after = await readFile(join(directory, ".licenses.json"), "utf8");
    expect(after).toBe(before);
  });
});
