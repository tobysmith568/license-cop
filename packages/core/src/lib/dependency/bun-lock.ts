import { z } from "zod";

const bunLockWorkspaceSchema = z.object({
  name: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional()
});

// Keyed by each workspace member's path relative to the lockfile, `""` for the root project itself
// (present even for a single, non-workspace project).
export const bunLockSchema = z.object({
  workspaces: z.record(z.string(), bunLockWorkspaceSchema)
});

export type BunLockWorkspace = z.infer<typeof bunLockWorkspaceSchema>;

/**
 * Only a project's declared dependencies are read from bun.lock here (including which are
 * workspace members, via a `"workspace:"` specifier). *Resolving* a declared dependency to where it
 * actually lives on disk is done by following bun's own `node_modules` symlinks instead, see
 * BunStoreResolver: a resolution's store folder name isn't always predictable, e.g. a `file:`
 * dependency's is a hash, not a plain `name@version`.
 */
export class BunLock {
  private readonly pathsByName: Map<string, string>;

  constructor(private readonly workspaces: Record<string, BunLockWorkspace>) {
    const named = Object.entries(workspaces).filter(
      (entry): entry is [string, BunLockWorkspace & { name: string }] => {
        return entry[1].name !== undefined;
      }
    );

    this.pathsByName = new Map(named.map(([path, workspace]) => [workspace.name, path]));
  }

  /** Every workspace, as its path relative to the lockfile and its declared dependencies. */
  members(): [string, BunLockWorkspace][] {
    return Object.entries(this.workspaces);
  }

  workspaceAt(path: string): BunLockWorkspace | undefined {
    return this.workspaces[path];
  }

  pathOfWorkspaceNamed(name: string): string | undefined {
    return this.pathsByName.get(name);
  }
}
