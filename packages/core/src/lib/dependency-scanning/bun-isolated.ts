import { realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readBunLock } from "../dependency/bun-lock";
import { readDeclaredDependencies, readPackageJson } from "../dependency/package-json";
import type { CheckLicensesResult } from "../result";
import { directoryExists } from "../utils/directory-exists";
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

  // Tracks store directories already walked, so a diamond dependency (or a genuine cycle, which
  // nothing downstream here otherwise guards against) is only expanded once; classifyDependencies
  // would dedupe the result by id regardless, so skipping a repeat costs nothing.
  const visited = new Set<string>();

  const buildNode = async (name: string, containerDir: string): Promise<NormalizedNode[]> => {
    onVerbose(`Parsing node: ${name}`);

    const resolvedDir = await resolvePackageDir(containerDir, name);
    if (!resolvedDir) {
      return [];
    }

    if (visited.has(resolvedDir)) {
      return [];
    }
    visited.add(resolvedDir);

    const packageJsonPath = join(resolvedDir, "package.json");
    const packageJson = await readPackageJson(packageJsonPath, onVerbose);
    const declared = await readDeclaredDependencies(packageJsonPath, onVerbose);
    const childContainer = storeRootFor(resolvedDir, name);

    const children: NormalizedNode[] = [];
    for (const childName of [...declared.dependencies, ...declared.optionalDependencies]) {
      children.push(...(await buildNode(childName, childContainer)));
    }

    return [
      {
        id: `${packageJson.name}@${packageJson.version}`,
        name: packageJson.name,
        packageJson,
        children
      }
    ];
  };

  // A workspace member linked in as a dependency (`"workspace:*"`) is the project's own code, not a
  // dependency of it, so it isn't checked. Its own dependencies are (they're also scanned through
  // its own project entry, so this only repeats them, harmlessly), same as npm.ts/pnpm.ts.
  const normalizeRootDependency = async (
    name: string,
    specifier: string,
    containerDir: string
  ): Promise<NormalizedNode[]> => {
    if (specifier.startsWith("workspace:")) {
      const memberPath = workspacePathsByName.get(name);
      return memberPath === undefined ? [] : await normalizeWorkspaceDependencies(memberPath);
    }

    return await buildNode(name, containerDir);
  };

  const normalizeWorkspaceDependencies = async (memberPath: string): Promise<NormalizedNode[]> => {
    const workspace = lock.workspaces[memberPath];
    if (!workspace) {
      return [];
    }

    const containerDir = join(workingDirectory, memberPath);
    const dependencies = { ...workspace.dependencies, ...workspace.optionalDependencies };

    const normalized: NormalizedNode[] = [];
    for (const [name, specifier] of Object.entries(dependencies)) {
      normalized.push(...(await normalizeRootDependency(name, specifier, containerDir)));
    }

    return normalized;
  };

  const normalizedNodes: NormalizedNode[] = [];

  for (const [memberPath, workspace] of Object.entries(lock.workspaces)) {
    const containerDir = join(workingDirectory, memberPath);

    // Dev-dependencies are filtered upstream here, via which of a workspace's dependency maps get
    // walked, the same as pnpm.ts. Optional dependencies are scanned with the production ones, since
    // an optional dependency that got installed is shipped like any other.
    const dependencies = devDependenciesOnly
      ? {}
      : { ...workspace.dependencies, ...workspace.optionalDependencies };
    const devDependencies =
      includeDevDependencies || devDependenciesOnly ? (workspace.devDependencies ?? {}) : {};

    for (const [name, specifier] of Object.entries(dependencies)) {
      normalizedNodes.push(...(await normalizeRootDependency(name, specifier, containerDir)));
    }
    for (const [name, specifier] of Object.entries(devDependencies)) {
      normalizedNodes.push(...(await normalizeRootDependency(name, specifier, containerDir)));
    }
  }

  return classifyDependencies(normalizedNodes, { allowedLicenses, allowedPackages, onVerbose });
};

/**
 * A dependency's resolution lives at `<containerDir>/node_modules/<name>`, a symlink bun itself
 * writes (into its central store for the isolated linker, or straight into another workspace member
 * for a hoisted-adjacent link). Resolving it this way, rather than predicting the store's own folder
 * name, works regardless of that folder's naming scheme.
 */
const resolvePackageDir = async (
  containerDir: string,
  name: string
): Promise<string | undefined> => {
  const candidate = join(containerDir, "node_modules", ...name.split("/"));

  if (!(await directoryExists(candidate))) {
    return undefined;
  }

  return await realpath(candidate);
};

/**
 * The store directory holding a resolved package also holds (as siblings of the package's own
 * folder, inside the same `node_modules`) whatever satisfies *its* dependencies, bun's own
 * equivalent of pnpm's per-package virtual store folder. Walking back up past
 * `node_modules/<name>` (one path segment per part of a scoped name, plus `node_modules` itself)
 * recovers that folder without needing to know its name, which for a `file:` dependency bun hashes
 * rather than deriving from `name@version`.
 */
const storeRootFor = (resolvedDir: string, name: string): string => {
  const segmentsToStrip = name.split("/").length + 1;

  let dir = resolvedDir;
  for (let i = 0; i < segmentsToStrip; i++) {
    dir = dirname(dir);
  }

  return dir;
};
