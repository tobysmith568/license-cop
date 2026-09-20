import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { join, relative } from "node:path";
import type { DependencyScanningOptions } from "./dependency-scanning/options";
import type { CheckLicensesResult } from "./result";

const emptyResult = (label: string) =>
  ({ label, allowedPackages: new Set() }) as unknown as CheckLicensesResult;

const npmDependencyScanning = mock();
const pnpmDependencyScanning = mock();

void mock.module("./dependency-scanning/npm", () => ({ npmDependencyScanning }));
void mock.module("./dependency-scanning/pnpm", () => ({ pnpmDependencyScanning }));

const { checkLicenses } = await import("./license-cop");

describe("checkLicenses", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
    npmDependencyScanning.mockReset().mockResolvedValue(emptyResult("npm"));
    pnpmDependencyScanning.mockReset().mockResolvedValue(emptyResult("pnpm"));
  });

  afterEach(async () => {
    await dir.remove();
  });

  const packageJson = (extra: object = {}) => ({ name: "test", version: "1.0.0", ...extra });

  const baseOptions = () => ({
    allowedLicenses: ["MIT"],
    allowedPackages: ["react"],
    workingDirectory: dir.path
  });

  describe("choosing an engine", () => {
    it("should use pnpm for a pnpm project", async () => {
      await dir.write({ "package.json": packageJson({ packageManager: "pnpm@10.0.0" }) });

      const result = await checkLicenses(baseOptions());

      expect(result).toEqual(emptyResult("pnpm"));
      expect(npmDependencyScanning).not.toHaveBeenCalled();
    });

    it("should use npm for an npm project", async () => {
      await dir.write({ "package.json": packageJson() });

      const result = await checkLicenses(baseOptions());

      expect(result).toEqual(emptyResult("npm"));
      expect(pnpmDependencyScanning).not.toHaveBeenCalled();
    });

    it("should use the npm engine for yarn, which shares npm's node_modules layout", async () => {
      await dir.write({ "package.json": packageJson(), "yarn.lock": "" });

      const result = await checkLicenses(baseOptions());

      expect(result).toEqual(emptyResult("npm"));
    });
  });

  describe("options", () => {
    beforeEach(async () => {
      await dir.write({ "package.json": packageJson() });
    });

    it("should pass the options on to the engine", async () => {
      const onVerbose = () => {};

      await checkLicenses({
        ...baseOptions(),
        includeDevDependencies: true,
        devDependenciesOnly: true,
        onVerbose
      });

      expect(npmDependencyScanning).toHaveBeenCalledWith({
        allowedLicenses: ["MIT"],
        allowedPackages: ["react"],
        workingDirectory: dir.path,
        includeDevDependencies: true,
        devDependenciesOnly: true,
        onVerbose
      });
    });

    it("should default the dev dependency options to false and onVerbose to a no-op", async () => {
      await checkLicenses(baseOptions());

      const [options] = npmDependencyScanning.mock.calls[0] as [DependencyScanningOptions];
      expect(options.includeDevDependencies).toBe(false);
      expect(options.devDependenciesOnly).toBe(false);
      expect(typeof options.onVerbose).toBe("function");
    });

    it("should resolve a relative working directory against the current directory", async () => {
      const relativeDirectory = relative(process.cwd(), dir.path);

      await checkLicenses({ ...baseOptions(), workingDirectory: relativeDirectory });

      const [options] = npmDependencyScanning.mock.calls[0] as [{ workingDirectory: string }];
      expect(options.workingDirectory).toBe(join(process.cwd(), relativeDirectory));
    });

    it("should default the working directory to the current directory", async () => {
      const previous = process.cwd();
      process.chdir(dir.path);

      try {
        await checkLicenses({ allowedLicenses: [], allowedPackages: [] });
      } finally {
        process.chdir(previous);
      }

      const [options] = npmDependencyScanning.mock.calls[0] as [{ workingDirectory: string }];
      expect(await Bun.file(join(options.workingDirectory, "package.json")).exists()).toBe(true);
    });
  });

  it("should throw when the working directory has no package.json", async () => {
    const act = checkLicenses(baseOptions());

    await expect(act).rejects.toThrow("Cannot find the file");
  });
});
