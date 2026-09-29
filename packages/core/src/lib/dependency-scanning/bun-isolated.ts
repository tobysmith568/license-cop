import { join } from "node:path";
import { readBunLock, resolveBunLockPackage } from "../dependency/bun-lock";
import { readPackageJson } from "../dependency/package-json";
import type { CheckLicensesResult } from "../result";
import { classifyDependencies, type NormalizedNode } from "./classify-dependencies";
import type { DependencyScanningOptions } from "./options";

export const bunIsolatedDependencyScanning = async (
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

  const lock = await readBunLock(workingDirectory, onVerbose);

  const workspacePathsByName = new Map(
    Object.entries(lock.workspaces)
      .filter((entry): entry is [string, { name: string }] => entry[1].name !== undefined)
      .map(([path, workspace]) => [workspace.name, path])
  );

  // Dev-dependencies are filtered upstream here, via which of a workspace's dependency maps get
  // walked, the same as pnpm.ts. Optional dependencies are scanned with the production ones, since
  // an optional dependency that got installed is shipped like any other.
  const normalizeDependency = async (
    name: string,
    specifier: string,
    ancestorPath: string[]
  ): Promise<NormalizedNode[]> => {
    onVerbose(`Parsing node: ${name}`);

    // A workspace member linked in as a dependency (`"workspace:*"`) is the project's own code, not
    // a dependency of it, so it isn't checked. Its own dependencies are (they're also scanned
    // through its own project entry, so this only repeats them, harmlessly), same as npm.ts/pnpm.ts.
    if (specifier.startsWith("workspace:")) {
      const memberPath = workspacePathsByName.get(name);
      return memberPath === undefined ? [] : await normalizeWorkspaceDependencies(memberPath);
    }

    const resolved = resolveBunLockPackage(lock, ancestorPath, name);
    if (!resolved) {
      return [];
    }

    const packageJsonPath = join(
      workingDirectory,
      "node_modules",
      ".bun",
      `${resolved.name}@${resolved.version}`,
      "node_modules",
      resolved.name,
      "package.json"
    );
    const packageJson = await readPackageJson(packageJsonPath, onVerbose);
    const children = await normalizeDependencies(resolved.dependencies, [...ancestorPath, name]);

    return [{ id: `${resolved.name}@${resolved.version}`, name: packageJson.name, packageJson, children }];
  };

  const normalizeDependencies = async (
    dependencies: Record<string, string>,
    ancestorPath: string[]
  ): Promise<NormalizedNode[]> => {
    const normalized: NormalizedNode[] = [];

    for (const [name, specifier] of Object.entries(dependencies)) {
      normalized.push(...(await normalizeDependency(name, specifier, ancestorPath)));
    }

    return normalized;
  };

  const normalizeWorkspaceDependencies = async (memberPath: string): Promise<NormalizedNode[]> => {
    const workspace = lock.workspaces[memberPath];
    if (!workspace) {
      return [];
    }

    return await normalizeDependencies(
      { ...workspace.dependencies, ...workspace.optionalDependencies },
      []
    );
  };

  const normalizedNodes: NormalizedNode[] = [];

  for (const workspace of Object.values(lock.workspaces)) {
    const dependencies = devDependenciesOnly
      ? {}
      : { ...workspace.dependencies, ...workspace.optionalDependencies };
    const devDependencies =
      includeDevDependencies || devDependenciesOnly ? (workspace.devDependencies ?? {}) : {};

    normalizedNodes.push(...(await normalizeDependencies(dependencies, [])));
    normalizedNodes.push(...(await normalizeDependencies(devDependencies, [])));
  }

  return classifyDependencies(normalizedNodes, { allowedLicenses, allowedPackages, onVerbose });
};
