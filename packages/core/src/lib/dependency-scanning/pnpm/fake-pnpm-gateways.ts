import type { DependencyNode } from "@pnpm/reviewing.dependencies-hierarchy";
import type { Inclusion } from "../inclusion";
import type { PnpmHierarchies, PnpmHierarchyReader } from "./pnpm-hierarchy-reader";
import type { PnpmProjectLocator } from "./pnpm-project-locator";

/** Finds the projects it was given, for a test that has no lockfile. */
export class FakePnpmProjectLocator implements PnpmProjectLocator {
  constructor(private readonly projectPaths: string[]) {}

  async locate(): Promise<string[]> {
    return await Promise.resolve(this.projectPaths);
  }
}

/** What one project depends on, split the way pnpm's own hierarchy is. */
export type FakeHierarchy = {
  dependencies?: DependencyNode[];
  devDependencies?: DependencyNode[];
  optionalDependencies?: DependencyNode[];
};

/**
 * A hierarchy reader that answers from what it was given, and, as pnpm's library does, leaves out
 * the kinds of dependency the inclusion it is asked for doesn't cover.
 */
export class FakePnpmHierarchyReader implements PnpmHierarchyReader {
  readonly inclusions: Inclusion[] = [];

  constructor(private readonly hierarchies: Record<string, FakeHierarchy>) {}

  async read(
    _projectPaths: string[],
    _lockfileDirectory: string,
    inclusion: Inclusion
  ): Promise<PnpmHierarchies> {
    this.inclusions.push(inclusion);

    const included: PnpmHierarchies = {};

    for (const [projectPath, hierarchy] of Object.entries(this.hierarchies)) {
      included[projectPath] = {
        dependencies: inclusion.production ? hierarchy.dependencies : undefined,
        devDependencies: inclusion.development ? hierarchy.devDependencies : undefined,
        optionalDependencies: inclusion.production ? hierarchy.optionalDependencies : undefined
      };
    }

    return await Promise.resolve(included);
  }
}

/** A dependency node with the fields the engine doesn't read filled in. */
export const fakeDependencyNode = (
  name: string,
  version: string,
  path: string,
  dependencies?: DependencyNode[]
): DependencyNode => ({
  alias: name,
  name,
  version,
  path,
  isPeer: false,
  isSkipped: false,
  isMissing: false,
  dependencies
});
