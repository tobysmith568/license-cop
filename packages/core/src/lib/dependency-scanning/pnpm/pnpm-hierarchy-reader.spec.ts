import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, symlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { toInclusion } from "../inclusion";
import { LibraryPnpmHierarchyReader } from "./pnpm-hierarchy-reader";

// A real (hand-built) pnpm install, since the point of this class is how it drives pnpm's own
// library. The project has two prod packages (`prod` -> `prod-child`), a dev one and an optional
// one.
describe("LibraryPnpmHierarchyReader", () => {
  const reader = new LibraryPnpmHierarchyReader();

  let dir: TempDir;

  beforeAll(async () => {
    dir = await createTempDir();
    await createPnpmProject(dir);
  });

  afterAll(async () => {
    await dir.remove();
  });

  const read = async (includeDevDependencies: boolean, devDependenciesOnly: boolean) => {
    const inclusion = toInclusion({ includeDevDependencies, devDependenciesOnly });
    const hierarchies = await reader.read([dir.path], dir.path, inclusion);

    const hierarchy = hierarchies[dir.path];
    const names = (nodes: { name: string }[] | undefined) => (nodes ?? []).map(n => n.name);

    return {
      dependencies: names(hierarchy?.dependencies),
      devDependencies: names(hierarchy?.devDependencies),
      optionalDependencies: names(hierarchy?.optionalDependencies)
    };
  };

  it("should read production and optional dependencies by default", async () => {
    const result = await read(false, false);

    expect(result).toEqual({
      dependencies: ["prod"],
      devDependencies: [],
      optionalDependencies: ["optional"]
    });
  });

  it("should also read dev dependencies when they're included", async () => {
    const result = await read(true, false);

    expect(result).toEqual({
      dependencies: ["prod"],
      devDependencies: ["dev"],
      optionalDependencies: ["optional"]
    });
  });

  it("should only read dev dependencies when only they are wanted", async () => {
    const result = await read(false, true);

    expect(result).toEqual({
      dependencies: [],
      devDependencies: ["dev"],
      optionalDependencies: []
    });
  });

  it("should read the whole depth of the tree, with where each package is installed", async () => {
    const inclusion = toInclusion({ includeDevDependencies: false, devDependenciesOnly: false });

    const hierarchies = await reader.read([dir.path], dir.path, inclusion);

    const prod = hierarchies[dir.path]?.dependencies?.[0];
    expect(prod?.dependencies?.map(child => child.name)).toEqual(["prod-child"]);
    expect(prod?.path).toContain(join(".pnpm", "prod@1.0.0"));
  });
});

const createPnpmProject = async (dir: TempDir) => {
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
    optionalDependencies:
      optional:
        specifier: 1.0.0
        version: 1.0.0

packages:

  dev@1.0.0:
    resolution: {integrity: sha512-AAAA}

  optional@1.0.0:
    resolution: {integrity: sha512-AAAA}

  prod-child@1.0.0:
    resolution: {integrity: sha512-AAAA}

  prod@1.0.0:
    resolution: {integrity: sha512-AAAA}

snapshots:

  dev@1.0.0: {}

  optional@1.0.0:
    optional: true

  prod-child@1.0.0: {}

  prod@1.0.0:
    dependencies:
      prod-child: 1.0.0
`;

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

  await dir.write({
    "package.json": {
      name: "fixture",
      version: "0.0.0",
      dependencies: { prod: "1.0.0" },
      devDependencies: { dev: "1.0.0" },
      optionalDependencies: { optional: "1.0.0" }
    },
    "pnpm-lock.yaml": lockfile,
    "node_modules/.modules.yaml": modulesYaml,
    "node_modules/.pnpm/lock.yaml": lockfile
  });

  const modulesDir = join(dir.path, "node_modules");
  const virtualStore = (name: string) => join(modulesDir, ".pnpm", `${name}@1.0.0`, "node_modules");
  const link = async (linkPath: string, target: string) => {
    await mkdir(dirname(linkPath), { recursive: true });
    await symlink(relative(dirname(linkPath), target), linkPath);
  };

  for (const name of ["prod", "prod-child", "dev", "optional"]) {
    await dir.write({
      [join("node_modules/.pnpm", `${name}@1.0.0`, "node_modules", name, "package.json")]: {
        name,
        version: "1.0.0",
        license: "MIT"
      }
    });
  }

  await link(
    join(virtualStore("prod"), "prod-child"),
    join(virtualStore("prod-child"), "prod-child")
  );
  await link(join(modulesDir, "prod"), join(virtualStore("prod"), "prod"));
  await link(join(modulesDir, "dev"), join(virtualStore("dev"), "dev"));
  await link(join(modulesDir, "optional"), join(virtualStore("optional"), "optional"));
};
