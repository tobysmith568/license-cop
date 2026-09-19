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
  const normalizeNode = async (node: Node | Link): Promise<NormalizedNode | undefined> => {
    onVerbose(`Parsing node: ${node.name}`);

    const isDevDependency = node.dev;

    if (!includeDevDependencies && !devDependenciesOnly && isDevDependency) {
      return undefined;
    }

    if (devDependenciesOnly && !isDevDependency) {
      return undefined;
    }

    const packageJsonPath = join(node.realpath, "package.json");
    const packageJson = await readPackageJson(packageJsonPath, onVerbose);
    const children = await normalizeNodes(node.children.values());

    return { id: node.pkgid, name: node.name, packageJson, children };
  };

  const normalizeNodes = async (nodes: IterableIterator<Node | Link>) => {
    const normalized: NormalizedNode[] = [];

    for (const node of nodes) {
      const normalizedNode = await normalizeNode(node);

      if (normalizedNode) {
        normalized.push(normalizedNode);
      }
    }

    return normalized;
  };

  const normalizedNodes = await normalizeNodes(topNode.children.values());

  return classifyDependencies(normalizedNodes, { allowedLicenses, allowedPackages, onVerbose });
};
