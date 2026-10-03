import { readWantedLockfile } from "@pnpm/lockfile.fs";
import { join } from "node:path";

/** Finds every project a pnpm install covers. */
export interface PnpmProjectLocator {
  locate(workingDirectory: string): Promise<string[]>;
}

/**
 * In a workspace, the root's own dependencies are rarely where the dependencies are: each member
 * has its own. The lockfile lists every project it covers (`importers`, relative to the lockfile),
 * so all of them are scanned. Without a lockfile that covers this directory, it's just this project.
 */
export class LockfilePnpmProjectLocator implements PnpmProjectLocator {
  async locate(workingDirectory: string): Promise<string[]> {
    const lockfile = await readWantedLockfile(workingDirectory, { ignoreIncompatible: false });

    const importerIds = Object.keys(lockfile?.importers ?? {});

    if (importerIds.length === 0) {
      return [workingDirectory];
    }

    return importerIds.map(importerId => join(workingDirectory, importerId));
  }
}
