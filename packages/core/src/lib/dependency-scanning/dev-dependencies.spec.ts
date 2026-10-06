import { describe, expect, it } from "bun:test";
import { dirname, join } from "node:path";
import { compose, type Gateways } from "../composition-root";
import { createMemoryDir, type MemoryDir } from "../utils/in-memory-file-system";
import type { DependencyScanningEngine } from "./dependency-scanning-engine";
import { FakeTreeLoader, type FakeNode } from "./node-modules/fake-tree-loader";
import {
  FakePnpmHierarchyReader,
  FakePnpmProjectLocator,
  fakeDependencyNode
} from "./pnpm/fake-pnpm-gateways";
import type { PnpmDependencyNode } from "./pnpm/pnpm-hierarchy-reader";
import { FakePnpInstallReader } from "./yarn-pnp/fake-pnp-install-reader";

// Pins down how each engine treats dev-dependencies from the caller's perspective, so that the
// engines can be refactored onto a shared classifier without changing behaviour.
//
// The fixture project has two prod packages (`prod` -> `prod-child`), two dev packages
// (`dev` -> `dev-child`) and an optional one (`optional`), all MIT licensed.
//
// Nothing here touches the disk: the project's files are in memory, and arborist's and pnpm's
// libraries, which can only read a real install, are swapped for fakes that answer what they would
// for this project. What those libraries actually read is covered by the real-install comparison
// (compare-core.ts) and the contract tests, not here.

const writeProjectPackageJson = (dir: MemoryDir) => {
  dir.write({
    "package.json": {
      name: "fixture",
      version: "0.0.0",
      dependencies: { prod: "1.0.0" },
      devDependencies: { dev: "1.0.0" },
      optionalDependencies: { optional: "1.0.0" }
    }
  });
};

const writePackage = (dir: MemoryDir, path: string, name: string, dependencies?: string[]) => {
  const dependencyVersions = Object.fromEntries(
    (dependencies ?? []).map(dependency => [dependency, "1.0.0"])
  );

  dir.fileSystem.addFile(join(path, "package.json"), {
    name,
    version: "1.0.0",
    license: "MIT",
    ...(dependencies ? { dependencies: dependencyVersions } : {})
  });
};

const createNpmProject = (dir: MemoryDir): Gateways => {
  writeProjectPackageJson(dir);

  const node = (name: string, dev = false): FakeNode => {
    const path = join(dir.path, "node_modules", name);
    writePackage(dir, path, name);

    return { name, version: "1.0.0", path, dev };
  };

  // arborist hoists: every package is a child of the top node, none nested inside another
  const hoisted = [
    node("optional"),
    node("prod"),
    node("prod-child"),
    node("dev", true),
    node("dev-child", true)
  ];

  return { treeLoader: new FakeTreeLoader(hoisted) };
};

const createPnpmProject = (dir: MemoryDir): Gateways => {
  writeProjectPackageJson(dir);

  const virtualStore = join(dir.path, "node_modules", ".pnpm");

  const node = (name: string, dependencies?: PnpmDependencyNode[]) => {
    const path = join(virtualStore, `${name}@1.0.0`, "node_modules", name);
    writePackage(
      dir,
      path,
      name,
      dependencies?.map(dependency => dependency.name)
    );

    return fakeDependencyNode(name, "1.0.0", path, dependencies);
  };

  const hierarchy = {
    dependencies: [node("prod", [node("prod-child")])],
    devDependencies: [node("dev", [node("dev-child")])],
    optionalDependencies: [node("optional")]
  };

  return {
    pnpmProjectLocator: new FakePnpmProjectLocator([dir.path]),
    pnpmHierarchyReader: new FakePnpmHierarchyReader({ [dir.path]: hierarchy })
  };
};

const createBunIsolatedProject = (dir: MemoryDir): Gateways => {
  writeProjectPackageJson(dir);

  dir.write({
    "bun.lock": {
      lockfileVersion: 2,
      configVersion: 1,
      workspaces: {
        "": {
          name: "fixture",
          dependencies: { prod: "1.0.0" },
          devDependencies: { dev: "1.0.0" },
          optionalDependencies: { optional: "1.0.0" }
        }
      }
    }
  });

  const modulesDir = join(dir.path, "node_modules");
  // bun's isolated store: each package's real files under .bun/<name>@<version>/node_modules/<name>,
  // with its own dependency edges symlinked as siblings inside that same node_modules.
  const store = (name: string) => join(modulesDir, ".bun", `${name}@1.0.0`, "node_modules", name);

  const link = (linkPath: string, target: string) => dir.fileSystem.addSymlink(linkPath, target);

  writePackage(dir, store("prod"), "prod", ["prod-child"]);
  writePackage(dir, store("prod-child"), "prod-child");
  writePackage(dir, store("dev"), "dev", ["dev-child"]);
  writePackage(dir, store("dev-child"), "dev-child");
  writePackage(dir, store("optional"), "optional");

  link(join(modulesDir, "prod"), store("prod"));
  link(join(modulesDir, "dev"), store("dev"));
  link(join(modulesDir, "optional"), store("optional"));
  link(join(dirname(store("prod")), "prod-child"), store("prod-child"));
  link(join(dirname(store("dev")), "dev-child"), store("dev-child"));

  return {};
};

const createYarnPnpProject = (dir: MemoryDir): Gateways => {
  writeProjectPackageJson(dir);

  // Plug'n'Play's map for the workspace lists everything it asked for, development or not, and
  // keeps each package's own dependencies with it
  const pnpPackage = (name: string, dependencies?: string[]) => {
    const directory = join(dir.path, ".yarn", "cache", `${name}.zip`, "node_modules", name);
    writePackage(dir, directory, name, dependencies);

    return {
      id: `${name}@npm:1.0.0`,
      directory,
      dependencies: Object.fromEntries(
        (dependencies ?? []).map(dependency => [dependency, `${dependency}@npm:1.0.0`])
      )
    };
  };

  const workspace = {
    id: "fixture@workspace:.",
    directory: dir.path,
    isWorkspace: true,
    dependencies: {
      prod: "prod@npm:1.0.0",
      dev: "dev@npm:1.0.0",
      optional: "optional@npm:1.0.0"
    }
  };

  const install = new FakePnpInstallReader([
    workspace,
    pnpPackage("prod", ["prod-child"]),
    pnpPackage("prod-child"),
    pnpPackage("dev", ["dev-child"]),
    pnpPackage("dev-child"),
    pnpPackage("optional")
  ]);

  return { yarnPnpInstallReader: install, yarnPnpFileSystem: dir.fileSystem };
};

type Setup = {
  /** Writes the project and returns the gateways that stand in for the libraries it needs. */
  create: (dir: MemoryDir) => Gateways;
  engine: (services: ReturnType<typeof compose>) => DependencyScanningEngine;
};

const setups: [string, Setup][] = [
  [
    "npm",
    {
      create: createNpmProject,
      engine: services => services.engines.nodeModules
    }
  ],
  [
    "pnpm",
    {
      create: createPnpmProject,
      engine: services => services.engines.pnpmStore
    }
  ],
  [
    "bun-isolated",
    {
      create: createBunIsolatedProject,
      engine: services => services.engines.bunIsolated
    }
  ],
  [
    "yarn-pnp",
    {
      create: createYarnPnpProject,
      engine: services => services.engines.yarnPnp
    }
  ]
];

describe.each(setups)("%s dev-dependency handling", (_name, setup) => {
  const run = async (includeDevDependencies: boolean, devDependenciesOnly: boolean) => {
    const dir = createMemoryDir();
    const gateways = setup.create(dir);
    const services = compose(undefined, { ...gateways, fileSystem: dir.fileSystem });
    const engine = setup.engine(services);

    const result = await engine.scan({
      workingDirectory: dir.path,
      allowedLicenses: ["MIT"],
      allowedPackages: [],
      includeDevDependencies,
      devDependenciesOnly
    });

    return [...result.allowedLicenses].map(pkg => pkg.name).sort();
  };

  it("should only find production dependencies by default", async () => {
    const found = await run(false, false);

    expect(found).toEqual(["optional", "prod", "prod-child"]);
  });

  it("should find production and dev dependencies when including dev dependencies", async () => {
    const found = await run(true, false);

    expect(found).toEqual(["dev", "dev-child", "optional", "prod", "prod-child"]);
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
