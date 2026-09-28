import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { NotInstalledError } from "../not-installed-error";
import { assertInstalled, type InstalledScope } from "./assert-installed";

describe("assertInstalled", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  const production: InstalledScope = { includeDevDependencies: false, devDependenciesOnly: false };
  const withDev: InstalledScope = { includeDevDependencies: true, devDependenciesOnly: false };
  const devOnly: InstalledScope = { includeDevDependencies: false, devDependenciesOnly: true };

  const writePackageJson = (extra: object) =>
    dir.write({ "package.json": { name: "test", version: "1.0.0", ...extra } });

  const install = () => mkdir(join(dir.path, "node_modules"));

  describe("when nothing is installed", () => {
    it.each([
      ["dependencies", { dependencies: { a: "1.0.0" } }],
      ["optionalDependencies", { optionalDependencies: { a: "1.0.0" } }]
    ])("should fail when there are %s to scan", async (_name, declared) => {
      await writePackageJson(declared);

      const act = assertInstalled(dir.path, "npm", production);

      await expect(act).rejects.toThrow(NotInstalledError);
    });

    it("should pass when nothing is declared", async () => {
      await writePackageJson({});

      const act = assertInstalled(dir.path, "npm", production);

      await expect(act).resolves.toBeUndefined();
    });

    it("should not count dev dependencies unless they're being scanned", async () => {
      await writePackageJson({ devDependencies: { a: "1.0.0" } });

      const act = assertInstalled(dir.path, "npm", production);

      await expect(act).resolves.toBeUndefined();
    });

    it("should count dev dependencies when including them", async () => {
      await writePackageJson({ devDependencies: { a: "1.0.0" } });

      const act = assertInstalled(dir.path, "npm", withDev);

      await expect(act).rejects.toThrow(NotInstalledError);
    });

    it("should count dev dependencies when scanning only them", async () => {
      await writePackageJson({ devDependencies: { a: "1.0.0" } });

      const act = assertInstalled(dir.path, "npm", devOnly);

      await expect(act).rejects.toThrow(NotInstalledError);
    });

    it("should pass a dev-only scan of a project that has no dev dependencies", async () => {
      await writePackageJson({ dependencies: { a: "1.0.0" } });

      const act = assertInstalled(dir.path, "npm", devOnly);

      await expect(act).resolves.toBeUndefined();
    });
  });

  describe("when node_modules exists", () => {
    it("should pass", async () => {
      await writePackageJson({ dependencies: { a: "1.0.0" } });
      await install();

      const act = assertInstalled(dir.path, "npm", production);

      await expect(act).resolves.toBeUndefined();
    });

    it("should not accept a file called node_modules", async () => {
      await writePackageJson({ dependencies: { a: "1.0.0" } });
      await dir.write({ node_modules: "" });

      const act = assertInstalled(dir.path, "npm", production);

      await expect(act).rejects.toThrow(NotInstalledError);
    });
  });

  describe("the message", () => {
    it.each([
      ["npm", "npm install"],
      ["yarn", "yarn install"],
      ["pnpm", "pnpm install"]
    ] as const)("should name the install command of %s", async (packageManager, command) => {
      await writePackageJson({ dependencies: { a: "1.0.0" } });

      const act = assertInstalled(dir.path, packageManager, production);

      await expect(act).rejects.toThrow(`Run '${command}' first`);
    });

    it("should suggest the workspace root, for a workspace member", async () => {
      await writePackageJson({ dependencies: { a: "1.0.0" } });

      const act = assertInstalled(dir.path, "npm", production);

      await expect(act).rejects.toThrow("workspace root");
    });
  });
});
