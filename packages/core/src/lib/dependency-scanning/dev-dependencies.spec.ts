import { createTempDir, writeJson, type TempDir } from "@license-cop/test-utils";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { npmDependencyScanning } from "./npm";
import type { DependencyScanningOptions } from "./options";
import { pnpmDependencyScanning } from "./pnpm";

// Pins down how each engine treats dev-dependencies from the caller's perspective, so that the
// engines can be refactored onto a shared classifier without changing behaviour.
//
// The fixture project has two prod packages (`prod` -> `prod-child`) and two dev packages
// (`dev` -> `dev-child`), all MIT licensed.

type Scan = (options: DependencyScanningOptions) => ReturnType<typeof npmDependencyScanning>;

const engines: [string, () => string, Scan][] = [
  ["npm", () => npmDir, npmDependencyScanning],
  ["pnpm", () => pnpmDir, pnpmDependencyScanning]
];

let tempDir: TempDir;
let npmDir: string;
let pnpmDir: string;

beforeAll(async () => {
  tempDir = await createTempDir({ prefix: "license-cop-dev-deps-" });
  npmDir = join(tempDir.path, "npm");
  pnpmDir = join(tempDir.path, "pnpm");

  await createNpmFixture(npmDir);
  await createPnpmFixture(pnpmDir);
});

afterAll(async () => {
  await tempDir.remove();
});

describe.each(engines)("%s dev-dependency handling", (_name, getDir, scan) => {
  const run = async (includeDevDependencies: boolean, devDependenciesOnly: boolean) => {
    const result = await scan({
      workingDirectory: getDir(),
      allowedLicenses: ["MIT"],
      allowedPackages: [],
      includeDevDependencies,
      devDependenciesOnly,
      onVerbose: () => {}
    });

    return [...result.allowedLicenses].map(pkg => pkg.name).sort();
  };

  it("should only find production dependencies by default", async () => {
    const found = await run(false, false);

    expect(found).toEqual(["prod", "prod-child"]);
  });

  it("should find production and dev dependencies when including dev dependencies", async () => {
    const found = await run(true, false);

    expect(found).toEqual(["dev", "dev-child", "prod", "prod-child"]);
  });

  it("should only find dev dependencies when scanning dev dependencies only", async () => {
    const found = await run(false, true);

    expect(found).toEqual(["dev", "dev-child"]);
  });

  it("should only find dev dependencies when both flags are set", async () => {
    const found = await run(true, true);

    expect(found).toEqual(["dev", "dev-child"]);
  });
});

const createNpmFixture = async (dir: string) => {
  await writeJson(join(dir, "package.json"), {
    name: "fixture",
    version: "0.0.0",
    dependencies: { prod: "1.0.0" },
    devDependencies: { dev: "1.0.0" }
  });

  await writePackage(join(dir, "node_modules", "prod"), "prod", { "prod-child": "1.0.0" });
  await writePackage(join(dir, "node_modules", "prod-child"), "prod-child");
  await writePackage(join(dir, "node_modules", "dev"), "dev", { "dev-child": "1.0.0" });
  await writePackage(join(dir, "node_modules", "dev-child"), "dev-child");
};

const createPnpmFixture = async (dir: string) => {
  await writeJson(join(dir, "package.json"), {
    name: "fixture",
    version: "0.0.0",
    dependencies: { prod: "1.0.0" },
    devDependencies: { dev: "1.0.0" }
  });

  const lockfile = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      prod:
        specifier: 1.0.0
        version: 1.0.0
    devDependencies:
      dev:
        specifier: 1.0.0
        version: 1.0.0

packages:

  dev-child@1.0.0:
    resolution: {integrity: sha512-AAAA}

  dev@1.0.0:
    resolution: {integrity: sha512-AAAA}

  prod-child@1.0.0:
    resolution: {integrity: sha512-AAAA}

  prod@1.0.0:
    resolution: {integrity: sha512-AAAA}

snapshots:

  dev-child@1.0.0: {}

  dev@1.0.0:
    dependencies:
      dev-child: 1.0.0

  prod-child@1.0.0: {}

  prod@1.0.0:
    dependencies:
      prod-child: 1.0.0
`;
  await writeFile(join(dir, "pnpm-lock.yaml"), lockfile);

  const modulesYaml = `hoistPattern:
  - '*'
hoistedDependencies: {}
included:
  dependencies: true
  devDependencies: true
  optionalDependencies: true
injectedDeps: {}
layoutVersion: 5
nodeLinker: isolated
packageManager: pnpm@10.28.1
pendingBuilds: []
prunedAt: Mon, 01 Jan 2026 00:00:00 GMT
publicHoistPattern: []
registries:
  default: https://registry.npmjs.org/
skipped: []
storeDir: /tmp/store
virtualStoreDir: .pnpm
virtualStoreDirMaxLength: 120
`;
  const modulesDir = join(dir, "node_modules");
  await mkdir(modulesDir, { recursive: true });
  await writeFile(join(modulesDir, ".modules.yaml"), modulesYaml);
  await mkdir(join(modulesDir, ".pnpm"), { recursive: true });
  await writeFile(join(modulesDir, ".pnpm", "lock.yaml"), lockfile);

  const virtualStore = (name: string) => join(modulesDir, ".pnpm", `${name}@1.0.0`, "node_modules");

  await writePackage(join(virtualStore("prod"), "prod"), "prod");
  await writePackage(join(virtualStore("prod-child"), "prod-child"), "prod-child");
  await writePackage(join(virtualStore("dev"), "dev"), "dev");
  await writePackage(join(virtualStore("dev-child"), "dev-child"), "dev-child");

  await link(
    join(virtualStore("prod"), "prod-child"),
    join(virtualStore("prod-child"), "prod-child")
  );
  await link(join(virtualStore("dev"), "dev-child"), join(virtualStore("dev-child"), "dev-child"));
  await link(join(modulesDir, "prod"), join(virtualStore("prod"), "prod"));
  await link(join(modulesDir, "dev"), join(virtualStore("dev"), "dev"));
};

const writePackage = async (dir: string, name: string, dependencies?: Record<string, string>) => {
  await writeJson(join(dir, "package.json"), {
    name,
    version: "1.0.0",
    license: "MIT",
    ...(dependencies ? { dependencies } : {})
  });
};

const link = async (linkPath: string, target: string) => {
  await mkdir(dirname(linkPath), { recursive: true });
  await symlink(relative(dirname(linkPath), target), linkPath);
};
