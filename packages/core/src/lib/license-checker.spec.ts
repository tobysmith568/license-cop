import { beforeEach, describe, expect, it } from "bun:test";
import { join, relative } from "node:path";
import { compose, type Services } from "./composition-root";
import type {
  DependencyScanningEngine,
  DependencyScanningOptions
} from "./dependency-scanning/dependency-scanning-engine";
import { EngineRegistry } from "./dependency-scanning/engine-registry";
import { LicenseChecker } from "./license-checker";
import { NotInstalledError } from "./not-installed-error";
import { OptionsNormalizer } from "./options-normalizer";
import type { CheckLicensesResult } from "./result";
import { UnsupportedProjectError } from "./unsupported-project-error";
import { createMemoryDir, type MemoryDir } from "./utils/in-memory-file-system";

const emptyResult = (label: string) =>
  ({ label, allowedPackages: new Set() }) as unknown as CheckLicensesResult;

class FakeEngine implements DependencyScanningEngine {
  readonly calls: DependencyScanningOptions[] = [];

  constructor(private readonly result: CheckLicensesResult) {}

  async scan(options: DependencyScanningOptions): Promise<CheckLicensesResult> {
    this.calls.push(options);

    return await Promise.resolve(this.result);
  }
}

describe("LicenseChecker", () => {
  let dir: MemoryDir;
  let services: Services;
  let nodeModules: FakeEngine;
  let pnpmStore: FakeEngine;
  let bunIsolated: FakeEngine;
  let currentDirectory: string;

  beforeEach(() => {
    dir = createMemoryDir();
    services = compose(undefined, { fileSystem: dir.fileSystem });
    nodeModules = new FakeEngine(emptyResult("npm"));
    pnpmStore = new FakeEngine(emptyResult("pnpm"));
    bunIsolated = new FakeEngine(emptyResult("bun"));
    currentDirectory = process.cwd();
  });

  // Everything real except the disk and the engines, which are the part that needs real installs to
  // be useful
  const checker = () => {
    const { packageManagerDetector, installationVerifier } = services;
    const engines = new EngineRegistry({ nodeModules, pnpmStore, bunIsolated });
    const optionsNormalizer = new OptionsNormalizer(() => currentDirectory);

    return new LicenseChecker(
      optionsNormalizer,
      packageManagerDetector,
      installationVerifier,
      engines
    );
  };

  const packageJson = (extra: object = {}) => ({ name: "test", version: "1.0.0", ...extra });

  const baseOptions = () => ({
    allowedLicenses: ["MIT"],
    allowedPackages: ["react"],
    workingDirectory: dir.path
  });

  describe("choosing an engine", () => {
    it("should use pnpm for a pnpm project", async () => {
      dir.write({ "package.json": packageJson({ packageManager: "pnpm@10.0.0" }) });

      const result = await checker().check(baseOptions());

      expect(result).toEqual(emptyResult("pnpm"));
      expect(nodeModules.calls).toHaveLength(0);
    });

    it("should use npm for an npm project", async () => {
      dir.write({ "package.json": packageJson() });

      const result = await checker().check(baseOptions());

      expect(result).toEqual(emptyResult("npm"));
      expect(pnpmStore.calls).toHaveLength(0);
    });

    it("should use the npm engine for yarn, which shares npm's node_modules layout", async () => {
      dir.write({ "package.json": packageJson(), "yarn.lock": "" });

      const result = await checker().check(baseOptions());

      expect(result).toEqual(emptyResult("npm"));
    });
  });

  describe("Plug'n'Play", () => {
    it("should refuse a yarn project that uses Plug'n'Play without scanning it", async () => {
      dir.write({ "package.json": packageJson(), "yarn.lock": "", ".pnp.cjs": "" });

      const act = checker().check(baseOptions());

      await expect(act).rejects.toThrow(UnsupportedProjectError);
      expect(nodeModules.calls).toHaveLength(0);
    });

    it("should refuse when yarn is only named in the packageManager field", async () => {
      dir.write({
        "package.json": packageJson({ packageManager: "yarn@4.0.0" }),
        ".pnp.cjs": ""
      });

      const act = checker().check(baseOptions());

      await expect(act).rejects.toThrow(UnsupportedProjectError);
    });

    it("should not look for Plug'n'Play files in projects of other package managers", async () => {
      dir.write({ "package.json": packageJson(), ".pnp.cjs": "" });

      const result = await checker().check(baseOptions());

      expect(result).toEqual(emptyResult("npm"));
    });
  });

  describe("installation", () => {
    it("should refuse a project that has dependencies but isn't installed, without scanning it", async () => {
      dir.write({ "package.json": packageJson({ dependencies: { react: "19.0.0" } }) });

      const act = checker().check(baseOptions());

      await expect(act).rejects.toThrow(NotInstalledError);
      expect(nodeModules.calls).toHaveLength(0);
    });

    it("should scan a project that has dependencies and is installed", async () => {
      dir.write({
        "package.json": packageJson({ dependencies: { react: "19.0.0" } }),
        "node_modules/.keep": ""
      });

      const result = await checker().check(baseOptions());

      expect(result).toEqual(emptyResult("npm"));
    });
  });

  describe("options", () => {
    beforeEach(() => {
      dir.write({ "package.json": packageJson() });
    });

    it("should pass the options on to the engine", async () => {
      await checker().check({
        ...baseOptions(),
        includeDevDependencies: true,
        devDependenciesOnly: true
      });

      expect(nodeModules.calls).toEqual([
        {
          allowedLicenses: ["MIT"],
          allowedPackages: ["react"],
          workingDirectory: dir.path,
          includeDevDependencies: true,
          devDependenciesOnly: true
        }
      ]);
    });

    it("should default the dev dependency options to false", async () => {
      await checker().check(baseOptions());

      const [options] = nodeModules.calls as [DependencyScanningOptions];
      expect(options.includeDevDependencies).toBe(false);
      expect(options.devDependenciesOnly).toBe(false);
    });

    it("should resolve a relative working directory against the current directory", async () => {
      const relativeDirectory = relative(process.cwd(), dir.path);

      await checker().check({ ...baseOptions(), workingDirectory: relativeDirectory });

      const [options] = nodeModules.calls as [DependencyScanningOptions];
      expect(options.workingDirectory).toBe(join(process.cwd(), relativeDirectory));
    });

    it("should default the working directory to the current directory", async () => {
      currentDirectory = dir.path;

      await checker().check({ allowedLicenses: [], allowedPackages: [] });

      const [options] = nodeModules.calls as [DependencyScanningOptions];
      expect(options.workingDirectory).toBe(dir.path);
    });
  });

  it("should throw when the working directory has no package.json", async () => {
    const act = checker().check(baseOptions());

    await expect(act).rejects.toThrow("Cannot find the file");
  });
});
