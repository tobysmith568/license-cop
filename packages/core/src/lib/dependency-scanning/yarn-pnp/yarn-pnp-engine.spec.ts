import { beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { compose } from "../../composition-root";
import type { CheckLicensesResult } from "../../result";
import { createMemoryDir, type MemoryDir } from "../../utils/in-memory-file-system";
import { FakePnpInstallReader, type FakePnpPackage } from "./fake-pnp-install-reader";

// The walk over what a `.pnp.cjs` says is installed. Nothing here touches the disk or a real
// `.pnp.cjs`: the project's files are in memory and the install is what the fake reader was given.
// Reading a real one is covered by the reader's own spec and the contract tests.

describe("YarnPnpEngine", () => {
  let dir: MemoryDir;
  let packages: FakePnpPackage[];

  beforeEach(() => {
    dir = createMemoryDir();
    packages = [];
  });

  const writeWorkspace = (
    directory: string,
    manifest: object,
    dependencies: Record<string, string>
  ) => {
    dir.fileSystem.addFile(join(directory, "package.json"), { name: "workspace", ...manifest });
    packages.push({
      id: `workspace-${packages.length}@workspace:${directory}`,
      directory,
      isWorkspace: true,
      dependencies
    });
  };

  /** Installs a package inside a zip, as Yarn does, and returns its id. */
  const install = (
    name: string,
    options: { version?: string; license?: string; dependencies?: Record<string, string> } = {}
  ): string => {
    const { version = "1.0.0", license = "MIT", dependencies } = options;
    const id = `${name}@npm:${version}`;
    const directory = join(
      dir.path,
      ".yarn",
      "cache",
      `${name}-${version}.zip`,
      "node_modules",
      name
    );

    dir.fileSystem.addFile(join(directory, "package.json"), { name, version, license });
    packages.push({ id, directory, dependencies });

    return id;
  };

  const scan = async (
    options: { allowedPackages?: string[]; includeDevDependencies?: boolean } = {}
  ) => {
    const reader = new FakePnpInstallReader(packages);
    const { engines } = compose(undefined, {
      fileSystem: dir.fileSystem,
      yarnPnpInstallReader: reader,
      yarnPnpFileSystem: dir.fileSystem
    });

    return await engines.yarnPnp.scan({
      workingDirectory: dir.path,
      allowedLicenses: ["MIT"],
      allowedPackages: options.allowedPackages ?? [],
      includeDevDependencies: options.includeDevDependencies ?? false,
      devDependenciesOnly: false
    });
  };

  it("should find direct and transitive dependencies, nested as they are", async () => {
    const child = install("child");
    const parent = install("parent", { dependencies: { child } });
    writeWorkspace(dir.path, { dependencies: { parent: "1.0.0" } }, { parent });

    const result = await scan();

    expect(names(result.allowedLicenses)).toEqual(["child@1.0.0", "parent@1.0.0"]);
  });

  it("should report the license each package declares, from inside its zip", async () => {
    const isc = install("isc-package", { license: "ISC" });
    writeWorkspace(dir.path, { dependencies: { "isc-package": "1.0.0" } }, { "isc-package": isc });

    const result = await scan();

    expect(names(result.forbiddenLicenses)).toEqual(["isc-package@1.0.0"]);
  });

  describe("workspaces", () => {
    it("should scan the dependencies of every workspace", async () => {
      const a = install("a");
      const b = install("b");
      writeWorkspace(dir.path, {}, {});
      writeWorkspace(join(dir.path, "packages", "one"), { dependencies: { a: "1.0.0" } }, { a });
      writeWorkspace(join(dir.path, "packages", "two"), { dependencies: { b: "1.0.0" } }, { b });

      const result = await scan();

      expect(names(result.allowedLicenses)).toEqual(["a@1.0.0", "b@1.0.0"]);
    });

    it("should not report a workspace that another depends on, as it's the project's own code", async () => {
      const a = install("a");
      writeWorkspace(join(dir.path, "packages", "one"), { dependencies: { a: "1.0.0" } }, { a });
      const one = packages[0]!.id;
      writeWorkspace(
        join(dir.path, "packages", "two"),
        { dependencies: { "workspace-one": "workspace:*" } },
        { "workspace-one": one }
      );

      const result = await scan();

      expect(names(result.allowedLicenses)).toEqual(["a@1.0.0"]);
      expect(result.noLicenses.size).toBe(0);
    });
  });

  describe("what is installed", () => {
    it("should skip a dependency that isn't installed, such as an optional one for another platform", async () => {
      const present = install("present");
      writeWorkspace(
        dir.path,
        { dependencies: { present: "1.0.0" }, optionalDependencies: { absent: "1.0.0" } },
        { present }
      );

      const result = await scan();

      expect(names(result.allowedLicenses)).toEqual(["present@1.0.0"]);
    });

    it("should skip a dependency whose package the install doesn't list", async () => {
      const present = install("present");
      writeWorkspace(
        dir.path,
        { dependencies: { present: "1.0.0", ghost: "1.0.0" } },
        { present, ghost: "ghost@npm:1.0.0" }
      );

      const result = await scan();

      expect(names(result.allowedLicenses)).toEqual(["present@1.0.0"]);
    });

    it("should include a link: or portal: package, which isn't a workspace", async () => {
      const linked = install("linked");
      writeWorkspace(dir.path, { dependencies: { linked: "link:./linked" } }, { linked });

      const result = await scan();

      expect(names(result.allowedLicenses)).toEqual(["linked@1.0.0"]);
    });
  });

  describe("repeats", () => {
    it("should report a package once however many things depend on it", async () => {
      const shared = install("shared");
      const left = install("left", { dependencies: { shared } });
      const right = install("right", { dependencies: { shared } });
      writeWorkspace(
        dir.path,
        { dependencies: { left: "1.0.0", right: "1.0.0" } },
        { left, right }
      );

      const result = await scan();

      expect(names(result.allowedLicenses)).toEqual(["left@1.0.0", "right@1.0.0", "shared@1.0.0"]);
    });

    it("should report one package that was installed under two ids once", async () => {
      // A `file:` dependency carries the package that asked for it in its id, so the same tarball
      // asked for by two packages is two ids
      const first = install("tarball");
      const second = "tarball@file:other-parent";
      packages.push({ ...packages[packages.length - 1]!, id: second });
      const left = install("left", { dependencies: { tarball: first } });
      const right = install("right", { dependencies: { tarball: second } });
      writeWorkspace(
        dir.path,
        { dependencies: { left: "1.0.0", right: "1.0.0" } },
        { left, right }
      );

      const result = await scan();

      expect(names(result.allowedLicenses)).toEqual(["left@1.0.0", "right@1.0.0", "tarball@1.0.0"]);
    });

    it("should not loop forever on a dependency cycle", async () => {
      const a = install("a", { dependencies: { b: "b@npm:1.0.0" } });
      install("b", { dependencies: { a } });
      writeWorkspace(dir.path, { dependencies: { a: "1.0.0" } }, { a });

      const result = await scan();

      expect(names(result.allowedLicenses)).toEqual(["a@1.0.0", "b@1.0.0"]);
    });
  });

  describe("an npm: alias", () => {
    // `"aliased": "npm:real@1.0.0"` is asked for as `aliased` and is installed as `real`
    const installAliased = () => {
      const real = install("real", { license: "ISC" });
      writeWorkspace(dir.path, { dependencies: { aliased: "npm:real@1.0.0" } }, { aliased: real });
    };

    it("should be reported under the real name and version", async () => {
      installAliased();

      const result = await scan();

      expect(names(result.forbiddenLicenses)).toEqual(["real@1.0.0"]);
    });

    it("should be matched by the allowed packages list under the alias, as in node_modules", async () => {
      installAliased();

      const result = await scan({ allowedPackages: ["aliased"] });

      expect(names(result.allowedPackages)).toEqual(["real@1.0.0"]);
      expect(result.forbiddenLicenses.size).toBe(0);
    });

    it("should not be matched by the real name, as in node_modules", async () => {
      installAliased();

      const result = await scan({ allowedPackages: ["real"] });

      expect(names(result.forbiddenLicenses)).toEqual(["real@1.0.0"]);
    });
  });
});

const names = (packages: CheckLicensesResult[keyof CheckLicensesResult]) =>
  [...packages].map(pkg => `${pkg.name}@${pkg.version}`).sort();
