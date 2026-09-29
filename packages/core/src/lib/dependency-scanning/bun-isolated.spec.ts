import { createTempDir, writeJson, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { bunIsolatedDependencyScanning } from "./bun-isolated";

// dev-dependencies.spec.ts already pins down the dev/prod/optional split shared with npm.ts and
// pnpm.ts. This covers what's specific to bun.lock's own shape instead: path-qualified overrides
// for a version conflict, and a workspace member linked in as a dependency.
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

  const writePackage = async (name: string, version: string, license = "MIT") => {
    await writeJson(
      join(dir.path, "node_modules", ".bun", `${name}@${version}`, "node_modules", name, "package.json"),
      { name, version, license }
    );
  };

  it("should resolve a package's own version distinctly from a nested override", async () => {
    // root depends on is-number@4.0.0 directly, and on is-odd@3.0.1, which itself needs
    // is-number@^6.0.0: bun.lock records the nested one under the path-qualified "is-odd/is-number".
    await dir.write({
      "bun.lock": {
        lockfileVersion: 2,
        configVersion: 1,
        workspaces: {
          "": { name: "root", dependencies: { "is-number": "4.0.0", "is-odd": "3.0.1" } }
        },
        packages: {
          "is-number": ["is-number@4.0.0", "", {}, "sha512-x"],
          "is-odd": ["is-odd@3.0.1", "", { dependencies: { "is-number": "^6.0.0" } }, "sha512-x"],
          "is-odd/is-number": ["is-number@6.0.0", "", {}, "sha512-x"]
        }
      }
    });
    await writePackage("is-number", "4.0.0");
    await writePackage("is-odd", "3.0.1");
    await writePackage("is-number", "6.0.0");

    const result = await scan();

    const versions = [...result.allowedLicenses].map(pkg => `${pkg.name}@${pkg.version}`).sort();
    expect(versions).toEqual(["is-number@4.0.0", "is-number@6.0.0", "is-odd@3.0.1"]);
  });

  it("should scan a linked workspace member's dependencies instead of the member itself", async () => {
    // "c" depends on member "a" (workspace:*); "a" is the project's own code, not installed, so it
    // has no node_modules/.bun entry, only its own dependency "mit" does.
    await dir.write({
      "bun.lock": {
        lockfileVersion: 2,
        configVersion: 1,
        workspaces: {
          "": { name: "root" },
          "packages/a": { name: "pkg-a", dependencies: { mit: "1.0.0" } },
          "packages/c": { name: "pkg-c", dependencies: { "pkg-a": "workspace:*" } }
        },
        packages: {
          "pkg-a": ["pkg-a@workspace:packages/a"],
          mit: ["mit@1.0.0", "", {}, "sha512-x"]
        }
      }
    });
    await writePackage("mit", "1.0.0");

    const result = await scan();

    const names = [...result.allowedLicenses].map(pkg => pkg.name).sort();
    expect(names).toEqual(["mit"]);
    expect(result.noLicenses.size).toBe(0);
  });

  it("should skip a declared dependency the lockfile has no resolution for", async () => {
    await dir.write({
      "bun.lock": {
        lockfileVersion: 2,
        configVersion: 1,
        workspaces: { "": { name: "root", dependencies: { missing: "1.0.0" } } },
        packages: {}
      }
    });

    const result = await scan();

    expect(result.allowedLicenses.size).toBe(0);
    expect(result.noLicenses.size).toBe(0);
  });
});
