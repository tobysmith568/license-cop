import Arborist, { Link, Node } from "@npmcli/arborist";
import { join } from "node:path";
import { readPackageJson } from "../dependency/package-json";
import type { CheckLicensesResult } from "../result";
import { classifyDependencies, type NormalizedNode } from "./classify-dependencies";
import type { DependencyScanningOptions } from "./options";

export const npmDependencyScanning = async (
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

  const arborist = new Arborist({ path: workingDirectory });

  const topNode = await arborist.loadActual();

  // Dev-dependencies are filtered per node here, while walking arborist's tree
  // pnpm.ts filters them upstream instead, via the options it gives pnpm
  const normalizeNode = async (node: Node | Link): Promise<NormalizedNode[]> => {
    onVerbose(`Parsing node: ${node.name}`);

    // A workspace member is the project's own code, not a dependency of it, so it isn't checked.
    // Its dependencies are (each with its own dev flag), whether hoisted or nested inside it.
    if (node.isWorkspace) {
      return await normalizeNodes(node.children.values());
    }

    const isDevDependency = node.dev;

    if (!includeDevDependencies && !devDependenciesOnly && isDevDependency) {
      return [];
    }

    if (devDependenciesOnly && !isDevDependency) {
      return [];
    }

    const packageJsonPath = join(node.realpath, "package.json");
    const packageJson = await readPackageJson(packageJsonPath, onVerbose);
    const children = await normalizeNodes(node.children.values());

    return [{ id: node.pkgid, name: node.name, packageJson, children }];
  };

  const normalizeNodes = async (nodes: IterableIterator<Node | Link>) => {
    const normalized: NormalizedNode[] = [];

    for (const node of nodes) {
      const normalizedNodes = await normalizeNode(node);
      normalized.push(...normalizedNodes);
    }

    return normalized;
  };

  const normalizedNodes = await normalizeNodes(topNode.children.values());

  return classifyDependencies(normalizedNodes, { allowedLicenses, allowedPackages, onVerbose });
};
