import { depPathToFilename, refToRelative } from "@pnpm/deps.path";
import {
  getLockfileImporterId,
  readCurrentLockfile,
  type LockfileObject,
  type ProjectSnapshot
} from "@pnpm/lockfile.fs";
import { nameVerFromPkgSnapshot } from "@pnpm/lockfile.utils";
import { readModulesManifest } from "@pnpm/modules-yaml";
import { realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import type { Inclusion } from "../inclusion";

/** One installed package, and the packages it depends on. */
export type PnpmDependencyNode = {
  /** The name the dependent asks for it by, which is not always the package's own name. */
  alias: string;
  name: string;
  version: string;
  /** Where the package is installed. */
  path: string;
  /**
   * Left out where this package was already listed under another one, so every package is
   * expanded once however many others depend on it.
   */
  dependencies?: PnpmDependencyNode[];
};

/** What one project depends on, split the way its package.json declares it. */
export type PnpmHierarchy = {
  dependencies?: PnpmDependencyNode[];
  devDependencies?: PnpmDependencyNode[];
  optionalDependencies?: PnpmDependencyNode[];
};

/** The hierarchy of each project, by the path of the project. */
export type PnpmHierarchies = Record<string, PnpmHierarchy>;

/** Reads the dependency hierarchy of each of a set of pnpm projects. */
export interface PnpmHierarchyReader {
  read(
    projectPaths: string[],
    lockfileDirectory: string,
    inclusion: Inclusion
  ): Promise<PnpmHierarchies>;
}

/**
 * Walks pnpm's own record of what is installed: the "current" lockfile that pnpm keeps inside the
 * virtual store, which unlike the wanted lockfile only covers what was actually installed.
 */
export class LockfilePnpmHierarchyReader implements PnpmHierarchyReader {
  async read(
    projectPaths: string[],
    lockfileDirectory: string,
    inclusion: Inclusion
  ): Promise<PnpmHierarchies> {
    const modulesDirectory = resolve(lockfileDirectory, "node_modules");
    const modules = await readModulesManifest(modulesDirectory);

    const virtualStoreDirectory = modules?.virtualStoreDir ?? join(modulesDirectory, ".pnpm");
    const internalPnpmDirectory = join(modulesDirectory, ".pnpm");
    const lockfile = await readCurrentLockfile(internalPnpmDirectory, {
      ignoreIncompatible: false
    });

    const hierarchies: PnpmHierarchies = {};

    if (lockfile == null) {
      for (const projectPath of projectPaths) {
        hierarchies[projectPath] = {};
      }

      return hierarchies;
    }

    const walker = new LockfileWalker({
      lockfile,
      lockfileDirectory,
      modulesDirectory,
      virtualStoreDirectory,
      virtualStoreDirMaxLength: modules?.virtualStoreDirMaxLength ?? Infinity,
      skipped: new Set(modules?.skipped ?? [])
    });

    for (const projectPath of projectPaths) {
      const importerId = getLockfileImporterId(lockfileDirectory, projectPath);
      const importer = lockfile.importers[importerId];

      hierarchies[projectPath] =
        importer == null ? {} : walker.walkImporter(importerId, importer, inclusion);
    }

    return hierarchies;
  }
}

type Dependencies = Record<string, string>;

type LockfileWalkerOptions = {
  lockfile: LockfileObject;
  lockfileDirectory: string;
  modulesDirectory: string;
  virtualStoreDirectory: string;
  virtualStoreDirMaxLength: number;
  skipped: Set<string>;
};

/**
 * One read's walk over the lockfile. A package is expanded the first time it's met, wherever it is
 * met from, and only named after that. That also ends any cycle, and keeps a heavily shared
 * package from being expanded once per dependent.
 */
class LockfileWalker {
  private readonly expanded = new Set<string>();

  constructor(private readonly options: LockfileWalkerOptions) {}

  walkImporter(importerId: string, importer: ProjectSnapshot, inclusion: Inclusion): PnpmHierarchy {
    const linkBaseDirectory = join(this.options.lockfileDirectory, importerId);
    const modulesDirectory = join(linkBaseDirectory, "node_modules");

    const hierarchy: PnpmHierarchy = {};

    if (inclusion.production) {
      hierarchy.dependencies = this.walkAll(
        importer.dependencies,
        linkBaseDirectory,
        modulesDirectory
      );
      hierarchy.optionalDependencies = this.walkAll(
        importer.optionalDependencies,
        linkBaseDirectory,
        modulesDirectory
      );
    }

    if (inclusion.development) {
      hierarchy.devDependencies = this.walkAll(
        importer.devDependencies,
        linkBaseDirectory,
        modulesDirectory
      );
    }

    return hierarchy;
  }

  private walkAll(
    dependencies: Dependencies | undefined,
    linkBaseDirectory: string,
    parentPath: string
  ) {
    const aliases = Object.keys(dependencies ?? {}).sort();
    const nodes: PnpmDependencyNode[] = [];

    for (const alias of aliases) {
      const ref = dependencies?.[alias];

      if (ref == null) {
        continue;
      }

      const node = this.walk(alias, ref, linkBaseDirectory, parentPath);

      if (node != null) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  private walk(
    alias: string,
    ref: string,
    linkBaseDirectory: string,
    parentPath: string
  ): PnpmDependencyNode | undefined {
    const depPath = refToRelative(ref, alias);

    // Not a package from a registry, but a link to a directory. A workspace member is one of
    // these, and the engine scans it as a project of its own rather than through the link
    if (depPath == null) {
      const linkTarget = ref.slice("link:".length);
      const path = join(linkBaseDirectory, linkTarget);

      return { alias, name: alias, version: ref, path };
    }

    // An optional dependency that doesn't suit this machine isn't installed
    if (this.options.skipped.has(depPath)) {
      return undefined;
    }

    const snapshot = this.options.lockfile.packages?.[depPath];
    const { name, version } =
      snapshot == null ? { name: alias, version: ref } : nameVerFromPkgSnapshot(depPath, snapshot);

    const path = this.locate(depPath, name, alias, parentPath);
    const node: PnpmDependencyNode = { alias, name, version, path };

    if (snapshot == null || this.expanded.has(depPath)) {
      return node;
    }

    this.expanded.add(depPath);

    const children = { ...snapshot.dependencies, ...snapshot.optionalDependencies };
    const childAliases = Object.keys(children).sort();

    node.dependencies = [];

    for (const childAlias of childAliases) {
      const childRef = children[childAlias];

      if (childRef == null) {
        continue;
      }

      const child = this.walk(childAlias, childRef, this.options.lockfileDirectory, path);

      if (child != null) {
        node.dependencies.push(child);
      }
    }

    return node;
  }

  private locate(depPath: string, name: string, alias: string, parentPath: string) {
    const { modulesDirectory, virtualStoreDirectory, virtualStoreDirMaxLength } = this.options;

    const filename = depPathToFilename(depPath, virtualStoreDirMaxLength);
    const path = join(virtualStoreDirectory, filename, "node_modules", name);

    // A virtual store outside of the project is shared by many projects, so what's in it isn't
    // laid out for this one. What's installed under the dependent is, so it's found from there
    if (!virtualStoreDirectory.startsWith(modulesDirectory + sep)) {
      return resolveSharedStorePath(path, alias, parentPath);
    }

    return path;
  }
}

const resolveSharedStorePath = (fallback: string, alias: string, parentPath: string) => {
  // A package's siblings are in the node_modules it sits in, which a scope puts one level up
  let siblingsDirectory = parentPath;

  if (basename(parentPath) !== "node_modules") {
    siblingsDirectory = dirname(parentPath);

    if (basename(siblingsDirectory).startsWith("@")) {
      siblingsDirectory = dirname(siblingsDirectory);
    }
  }

  const installedPath = join(siblingsDirectory, alias);

  try {
    return realpathSync(installedPath);
  } catch {
    return fallback;
  }
};
