import type { Inclusion } from "../inclusion";
import type {
  PnpmDependencyNode,
  PnpmHierarchies,
  PnpmHierarchy,
  PnpmHierarchyReader
} from "./pnpm-hierarchy-reader";
import type { PnpmProjectLocator } from "./pnpm-project-locator";

/** Finds the projects it was given, for a test that has no lockfile. */
export class FakePnpmProjectLocator implements PnpmProjectLocator {
  constructor(private readonly projectPaths: string[]) {}

  async locate(): Promise<string[]> {
    return await Promise.resolve(this.projectPaths);
  }
}

/**
 * A hierarchy reader that answers from what it was given, and, as the real reader does, leaves out
 * the kinds of dependency the inclusion it is asked for doesn't cover.
 */
export class FakePnpmHierarchyReader implements PnpmHierarchyReader {
  readonly inclusions: Inclusion[] = [];

  constructor(private readonly hierarchies: Record<string, PnpmHierarchy>) {}

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

/** A dependency node, with its alias the same as its name. */
export const fakeDependencyNode = (
  name: string,
  version: string,
  path: string,
  dependencies?: PnpmDependencyNode[]
): PnpmDependencyNode => ({
  alias: name,
  name,
  version,
  path,
  dependencies
});
