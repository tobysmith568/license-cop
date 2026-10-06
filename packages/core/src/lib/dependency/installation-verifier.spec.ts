import { beforeEach, describe, expect, it } from "bun:test";
import { compose, type Services } from "../composition-root";
import { NotInstalledError } from "../not-installed-error";
import { createMemoryDir, type MemoryDir } from "../utils/in-memory-file-system";
import { type InstallationVerifier, type InstalledScope } from "./installation-verifier";

describe("InstallationVerifier", () => {
  let dir: MemoryDir;
  let installationVerifier: InstallationVerifier;
  let packageManagers: Services["packageManagers"];

  beforeEach(() => {
    dir = createMemoryDir();

    const services = compose(undefined, { fileSystem: dir.fileSystem });
    installationVerifier = services.installationVerifier;
    packageManagers = services.packageManagers;
  });

  const production: InstalledScope = { includeDevDependencies: false, devDependenciesOnly: false };
  const withDev: InstalledScope = { includeDevDependencies: true, devDependenciesOnly: false };
  const devOnly: InstalledScope = { includeDevDependencies: false, devDependenciesOnly: true };

  const writePackageJson = (extra: object) =>
    dir.write({ "package.json": { name: "test", version: "1.0.0", ...extra } });

  const install = () => dir.mkdir("node_modules");

  describe("when nothing is installed", () => {
    it.each([
      ["dependencies", { dependencies: { a: "1.0.0" } }],
      ["optionalDependencies", { optionalDependencies: { a: "1.0.0" } }]
    ])("should fail when there are %s to scan", async (_name, declared) => {
      writePackageJson(declared);

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.npm,
        "node-modules",
        production
      );

      await expect(act).rejects.toThrow(NotInstalledError);
    });

    it("should pass when nothing is declared", async () => {
      writePackageJson({});

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.npm,
        "node-modules",
        production
      );

      await expect(act).resolves.toBeUndefined();
    });

    it("should not count dev dependencies unless they're being scanned", async () => {
      writePackageJson({ devDependencies: { a: "1.0.0" } });

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.npm,
        "node-modules",
        production
      );

      await expect(act).resolves.toBeUndefined();
    });

    it("should count dev dependencies when including them", async () => {
      writePackageJson({ devDependencies: { a: "1.0.0" } });

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.npm,
        "node-modules",
        withDev
      );

      await expect(act).rejects.toThrow(NotInstalledError);
    });

    it("should count dev dependencies when scanning only them", async () => {
      writePackageJson({ devDependencies: { a: "1.0.0" } });

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.npm,
        "node-modules",
        devOnly
      );

      await expect(act).rejects.toThrow(NotInstalledError);
    });

    it("should pass a dev-only scan of a project that has no dev dependencies", async () => {
      writePackageJson({ dependencies: { a: "1.0.0" } });

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.npm,
        "node-modules",
        devOnly
      );

      await expect(act).resolves.toBeUndefined();
    });
  });

  describe("when node_modules exists", () => {
    it("should pass", async () => {
      writePackageJson({ dependencies: { a: "1.0.0" } });
      install();

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.npm,
        "node-modules",
        production
      );

      await expect(act).resolves.toBeUndefined();
    });

    it("should not accept a file called node_modules", async () => {
      writePackageJson({ dependencies: { a: "1.0.0" } });
      dir.write({ node_modules: "" });

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.npm,
        "node-modules",
        production
      );

      await expect(act).rejects.toThrow(NotInstalledError);
    });
  });

  describe("when the shape is Plug'n'Play", () => {
    it.each([".pnp.cjs", ".pnp.js"])("should pass when there is a %s", async file => {
      writePackageJson({ dependencies: { a: "1.0.0" } });
      dir.write({ [file]: "" });

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.yarn,
        "yarn-pnp",
        production
      );

      await expect(act).resolves.toBeUndefined();
    });

    it("should not need a node_modules", async () => {
      writePackageJson({ dependencies: { a: "1.0.0" } });
      dir.write({ ".pnp.cjs": "" });

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.yarn,
        "yarn-pnp",
        production
      );

      await expect(act).resolves.toBeUndefined();
    });

    it("should fail, naming the file, when there is none", async () => {
      writePackageJson({ dependencies: { a: "1.0.0" } });
      install();

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.yarn,
        "yarn-pnp",
        production
      );

      await expect(act).rejects.toThrow(NotInstalledError);
      await expect(act).rejects.toThrow("there is no .pnp.cjs");
    });
  });

  describe("when the shape isn't Plug'n'Play", () => {
    it("should not accept a .pnp.cjs in place of a node_modules", async () => {
      writePackageJson({ dependencies: { a: "1.0.0" } });
      dir.write({ ".pnp.cjs": "" });

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.yarn,
        "node-modules",
        production
      );

      await expect(act).rejects.toThrow("there is no node_modules");
    });
  });

  describe("the message", () => {
    it.each([
      ["npm", "npm install"],
      ["yarn", "yarn install"],
      ["pnpm", "pnpm install"]
    ] as const)("should name the install command of %s", async (packageManager, command) => {
      writePackageJson({ dependencies: { a: "1.0.0" } });

      const act = installationVerifier.verify(
        dir.path,
        packageManagers[packageManager],
        "node-modules",
        production
      );

      await expect(act).rejects.toThrow(`Run '${command}' first`);
    });

    it("should suggest the workspace root, for a workspace member", async () => {
      writePackageJson({ dependencies: { a: "1.0.0" } });

      const act = installationVerifier.verify(
        dir.path,
        packageManagers.npm,
        "node-modules",
        production
      );

      await expect(act).rejects.toThrow("workspace root");
    });
  });
});
