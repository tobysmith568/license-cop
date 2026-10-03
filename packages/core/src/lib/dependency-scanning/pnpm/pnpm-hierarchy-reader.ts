import { buildDependenciesTree } from "@pnpm/reviewing.dependencies-hierarchy";
import type { Inclusion } from "../inclusion";

export type PnpmHierarchies = Awaited<ReturnType<typeof buildDependenciesTree>>;

/** Reads the dependency hierarchy of each of a set of pnpm projects. */
export interface PnpmHierarchyReader {
  read(
    projectPaths: string[],
    lockfileDirectory: string,
    inclusion: Inclusion
  ): Promise<PnpmHierarchies>;
}

export class LibraryPnpmHierarchyReader implements PnpmHierarchyReader {
  // Dev-dependencies are filtered upstream here, via the options given to pnpm
  read(
    projectPaths: string[],
    lockfileDirectory: string,
    inclusion: Inclusion
  ): Promise<PnpmHierarchies> {
    return buildDependenciesTree(projectPaths, {
      depth: Infinity,
      include: {
        dependencies: inclusion.production,
        devDependencies: inclusion.development,
        optionalDependencies: inclusion.production
      },
      lockfileDir: lockfileDirectory,
      virtualStoreDirMaxLength: Infinity
    });
  }
}
