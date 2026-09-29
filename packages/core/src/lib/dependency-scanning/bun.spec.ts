import { createTempDir, writeJson, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { bunDependencyScanning } from "./bun";

describe("bunDependencyScanning", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  const scan = () =>
    bunDependencyScanning({
      workingDirectory: dir.path,
      allowedLicenses: ["MIT"],
      allowedPackages: [],
      includeDevDependencies: false,
      devDependenciesOnly: false,
      onVerbose: () => {}
    });

  it("should dispatch to the hoisted (npm-shaped) engine when node_modules/.bun is absent", async () => {
    await writeJson(join(dir.path, "package.json"), {
      name: "fixture",
      version: "0.0.0",
      dependencies: { prod: "1.0.0" }
    });
    await writeJson(join(dir.path, "node_modules", "prod", "package.json"), {
      name: "prod",
      version: "1.0.0",
      license: "MIT"
    });

    const result = await scan();

    expect([...result.allowedLicenses].map(pkg => pkg.name)).toEqual(["prod"]);
  });

  it("should dispatch to the isolated engine when node_modules/.bun is present", async () => {
    await dir.write({
      "bun.lock": {
        lockfileVersion: 2,
        configVersion: 1,
        workspaces: { "": { name: "fixture", dependencies: { prod: "1.0.0" } } },
        packages: { prod: ["prod@1.0.0", "", {}, "sha512-x"] }
      }
    });
    await mkdir(join(dir.path, "node_modules", ".bun"), { recursive: true });
    await writeJson(
      join(dir.path, "node_modules", ".bun", "prod@1.0.0", "node_modules", "prod", "package.json"),
      { name: "prod", version: "1.0.0", license: "MIT" }
    );

    const result = await scan();

    expect([...result.allowedLicenses].map(pkg => pkg.name)).toEqual(["prod"]);
  });
});
