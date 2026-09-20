import { buildDependenciesTree, type DependencyNode } from "@pnpm/reviewing.dependencies-hierarchy";
import { join } from "node:path";
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
  const dependencyHierarchies = await buildDependenciesTree([workingDirectory], {
    depth: Infinity,
    include: {
      dependencies: !devDependenciesOnly,
      devDependencies: includeDevDependencies || devDependenciesOnly,
      optionalDependencies: !devDependenciesOnly
    },
    lockfileDir: workingDirectory,
    virtualStoreDirMaxLength: Infinity
  });

  const normalizeNode = async (node: DependencyNode): Promise<NormalizedNode> => {
    onVerbose(`Parsing node: ${node.name}`);

    const packageJsonPath = join(node.path, "package.json");
    const packageJson = await readPackageJson(packageJsonPath, onVerbose);
    const children = await normalizeNodes(node.dependencies);

    return {
      id: `${node.alias}@${node.version}`,
      name: packageJson.name,
      packageJson,
      children
    };
  };

  const normalizeNodes = async (nodes: DependencyNode[] | undefined) => {
    const normalized: NormalizedNode[] = [];

    for (const node of nodes ?? []) {
      const normalizedNode = await normalizeNode(node);
      normalized.push(normalizedNode);
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
