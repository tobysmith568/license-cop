import { createTempDir, writeJson, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, symlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { bunIsolatedDependencyScanning } from "./bun-isolated";

// dev-dependencies.spec.ts already pins down the dev/prod/optional split shared with npm.ts and
// pnpm.ts. This covers what's specific to bun's isolated layout instead: a version conflict
// resolved to two different store folders, an oddly-named store folder (bun hashes one for a
// `file:` dependency rather than deriving it from `name@version`), and a workspace member linked in
// as a dependency.
describe("bunIsolatedDependencyScanning", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  const scan = () =>
    bunIsolatedDependencyScanning({
      workingDirectory: dir.path,
      allowedLicenses: ["MIT"],
      allowedPackages: [],
      includeDevDependencies: false,
      devDependenciesOnly: false,
      onVerbose: () => {}
    });

  // Mirrors bun's own isolated store layout: the resolved package's real files under
  // node_modules/.bun/<storeDirName>/node_modules/<name>, with the requesting project's own
  // node_modules/<name> symlinked to it. storeDirName is deliberately free-form, since bun doesn't
  // always derive it from name@version (a file: dependency's is a hash instead).
  const store = async (
    storeDirName: string,
    name: string,
    version: string,
    dependencies?: Record<string, string>
  ) => {
    const packageDir = join(dir.path, "node_modules", ".bun", storeDirName, "node_modules", name);
    await writeJson(join(packageDir, "package.json"), {
      name,
      version,
      license: "MIT",
      ...(dependencies ? { dependencies } : {})
    });
    return packageDir;
  };

  const link = async (fromDir: string, name: string, targetDir: string) => {
    const linkPath = join(fromDir, "node_modules", name);
    await mkdir(dirname(linkPath), { recursive: true });
    await symlink(relative(dirname(linkPath), targetDir), linkPath);
  };

  it("should resolve a package's own version distinctly from a nested version conflict", async () => {
    // root depends on is-number@4.0.0 directly, and on is-odd@3.0.1, which itself needs a different,
    // incompatible is-number: bun stores each under its own folder and symlinks each requester to
    // the one that satisfies it.
    await dir.write({
      "bun.lock": {
        lockfileVersion: 2,
        configVersion: 1,
        workspaces: {
          "": { name: "root", dependencies: { "is-number": "4.0.0", "is-odd": "3.0.1" } }
        }
      }
    });

    const isNumber4 = await store("is-number@4.0.0", "is-number", "4.0.0");
    const isOdd = await store("is-odd@3.0.1", "is-odd", "3.0.1", { "is-number": "^6.0.0" });
    const isNumber6 = await store("is-number@6.0.0", "is-number", "6.0.0");

    await link(dir.path, "is-number", isNumber4);
    await link(dir.path, "is-odd", isOdd);
    // is-odd's own node_modules (siblings of its own folder inside the same store dir) is where its
    // dependency on is-number is satisfied from, distinctly from root's.
    await link(dirname(dirname(isOdd)), "is-number", isNumber6);

    const result = await scan();

    const versions = [...result.allowedLicenses].map(pkg => `${pkg.name}@${pkg.version}`).sort();
    expect(versions).toEqual(["is-number@4.0.0", "is-number@6.0.0", "is-odd@3.0.1"]);
  });

  it("should resolve a dependency stored under a hashed, non name@version folder", async () => {
    // What bun actually does for a `file:` dependency: the store folder is a hash, not "name@version".
    await dir.write({
      "bun.lock": {
        lockfileVersion: 2,
        configVersion: 1,
        workspaces: { "": { name: "root", dependencies: { prod: "file:../prod.tgz" } } }
      }
    });

    const prodDir = await store("prod@file+..+prod.tgz-abc123", "prod", "1.0.0");
    await link(dir.path, "prod", prodDir);

    const result = await scan();

    expect([...result.allowedLicenses].map(pkg => pkg.name)).toEqual(["prod"]);
  });

  it("should scan a linked workspace member's dependencies instead of the member itself", async () => {
    // "c" depends on member "a" (workspace:*); "a" is the project's own code, not installed, so it
    // has no store entry, only its own dependency "mit" does.
    await dir.write({
      "bun.lock": {
        lockfileVersion: 2,
        configVersion: 1,
        workspaces: {
          "": { name: "root" },
          "packages/a": { name: "pkg-a", dependencies: { mit: "1.0.0" } },
          "packages/c": { name: "pkg-c", dependencies: { "pkg-a": "workspace:*" } }
        }
      }
    });

    const mitDir = await store("mit@1.0.0", "mit", "1.0.0");
    await link(join(dir.path, "packages/a"), "mit", mitDir);

    const result = await scan();

    const names = [...result.allowedLicenses].map(pkg => pkg.name).sort();
    expect(names).toEqual(["mit"]);
    expect(result.noLicenses.size).toBe(0);
  });

  it("should skip a declared dependency with no symlink to resolve it from", async () => {
    await dir.write({
      "bun.lock": {
        lockfileVersion: 2,
        configVersion: 1,
        workspaces: { "": { name: "root", dependencies: { missing: "1.0.0" } } }
      }
    });

    const result = await scan();

    expect(result.allowedLicenses.size).toBe(0);
    expect(result.noLicenses.size).toBe(0);
  });
});
