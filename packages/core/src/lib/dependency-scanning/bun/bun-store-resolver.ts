import { dirname, join } from "node:path";
import type { FileSystem } from "../../utils/file-system";

/** Finds where bun's isolated linker put a package, by following the symlinks bun itself wrote. */
export class BunStoreResolver {
  constructor(private readonly fileSystem: FileSystem) {}

  /**
   * A dependency's resolution lives at `<containerDir>/node_modules/<name>`, a symlink bun itself
   * writes (into its central store for the isolated linker, or straight into another workspace
   * member for a hoisted-adjacent link). Resolving it this way, rather than predicting the store's
   * own folder name, works regardless of that folder's naming scheme.
   */
  async resolvePackageDir(containerDir: string, name: string): Promise<string | undefined> {
    const candidate = join(containerDir, "node_modules", ...name.split("/"));

    const exists = await this.fileSystem.directoryExists(candidate);
    if (!exists) {
      return undefined;
    }

    return await this.fileSystem.realpath(candidate);
  }

  /**
   * The store directory holding a resolved package also holds (as siblings of the package's own
   * folder, inside the same `node_modules`) whatever satisfies *its* dependencies, bun's own
   * equivalent of pnpm's per-package virtual store folder. Walking back up past
   * `node_modules/<name>` (one path segment per part of a scoped name, plus `node_modules` itself)
   * recovers that folder without needing to know its name, which for a `file:` dependency bun
   * hashes rather than deriving from `name@version`.
   */
  storeRootFor(resolvedDir: string, name: string): string {
    const segmentsToStrip = name.split("/").length + 1;

    let dir = resolvedDir;
    for (let i = 0; i < segmentsToStrip; i++) {
      dir = dirname(dir);
    }

    return dir;
  }
}
