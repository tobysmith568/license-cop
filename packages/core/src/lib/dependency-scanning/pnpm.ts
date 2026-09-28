import { readWantedLockfile } from "@pnpm/lockfile.fs";
import { buildDependenciesTree, type DependencyNode } from "@pnpm/reviewing.dependencies-hierarchy";
import { join, resolve } from "node:path";
import { readPackageJson } from "../dependency/package-json";
import type { CheckLicensesResult } from "../result";
import { classifyDependencies, type NormalizedNode } from "./classify-dependencies";
import type { DependencyScanningOptions } from "./options";

export const pnpmDependencyScanning = async (
  options: DependencyScanningOptions
): Promise<CheckLicensesResult> => {
  const {
    workingDirectory,
    allowedLicenses,
    allowedPackages,
    includeDevDependencies,
    devDependenciesOnly,
    onVerbose
  } = options;

  // Dev-dependencies are filtered upstream here, via the options given to pnpm
  // npm.ts filters them per node instead, while walking arborist's tree
  // Optional dependencies are production dependencies that may not have been installed, so they're
  // scanned with the production ones, the same as npm.ts's tree includes them
  const projectPaths = await findProjectPaths(workingDirectory);

  const dependencyHierarchies = await buildDependenciesTree(projectPaths, {
    depth: Infinity,
    include: {
      dependencies: !devDependenciesOnly,
      devDependencies: includeDevDependencies || devDependenciesOnly,
      optionalDependencies: !devDependenciesOnly
    },
    lockfileDir: workingDirectory,
    virtualStoreDirMaxLength: Infinity
  });

  const workspaceProjectPaths = new Set(projectPaths.map(path => resolve(path)));

  const normalizeNode = async (node: DependencyNode): Promise<NormalizedNode[]> => {
    onVerbose(`Parsing node: ${node.name}`);

    // A workspace member that another one depends on shows up as a linked dependency. It's the
    // project's own code, not a dependency of it, so it isn't checked. Its dependencies are
    // (they're scanned through its own project too, so this only repeats them, harmlessly)
    if (workspaceProjectPaths.has(resolve(node.path))) {
      return await normalizeNodes(node.dependencies);
    }

    const packageJsonPath = join(node.path, "package.json");
    const packageJson = await readPackageJson(packageJsonPath, onVerbose);
    const children = await normalizeNodes(node.dependencies);

    return [
      {
        id: `${node.alias}@${node.version}`,
        name: packageJson.name,
        packageJson,
        children
      }
    ];
  };

  const normalizeNodes = async (nodes: DependencyNode[] | undefined) => {
    const normalized: NormalizedNode[] = [];

    for (const node of nodes ?? []) {
      const normalizedNodes = await normalizeNode(node);
      normalized.push(...normalizedNodes);
    }

    return normalized;
  };

  const normalizedNodes: NormalizedNode[] = [];

  for (const hierarchies of Object.values(dependencyHierarchies)) {
    const dependencies = await normalizeNodes(hierarchies.dependencies);
    const devDependencies = await normalizeNodes(hierarchies.devDependencies);
    const optionalDependencies = await normalizeNodes(hierarchies.optionalDependencies);

    normalizedNodes.push(...dependencies, ...devDependencies, ...optionalDependencies);
  }

  return classifyDependencies(normalizedNodes, { allowedLicenses, allowedPackages, onVerbose });
};

/**
 * In a workspace, the root's own dependencies are rarely where the dependencies are: each member
 * has its own. The lockfile lists every project it covers (`importers`, relative to the lockfile),
 * so all of them are scanned. Without a lockfile that covers this directory, it's just this project.
 */
const findProjectPaths = async (workingDirectory: string): Promise<string[]> => {
  const lockfile = await readWantedLockfile(workingDirectory, { ignoreIncompatible: false });

  const importerIds = Object.keys(lockfile?.importers ?? {});

  if (importerIds.length === 0) {
    return [workingDirectory];
  }

  return importerIds.map(importerId => join(workingDirectory, importerId));
};
