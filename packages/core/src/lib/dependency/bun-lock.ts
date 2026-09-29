import { readFile } from "fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { noopOnVerbose, type OnVerbose } from "../on-verbose";
import { fileExists } from "../utils/file-exists";
import { json5Parse } from "../utils/json5";
import { BunLockError } from "./bun-lock-error";

const bunLockWorkspaceValidator = z.object({
  name: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional()
});

// Keyed by each workspace member's path relative to the lockfile, `""` for the root project itself
// (present even for a single, non-workspace project).
const bunLockValidator = z.object({
  workspaces: z.record(z.string(), bunLockWorkspaceValidator)
});

export type BunLockWorkspace = z.infer<typeof bunLockWorkspaceValidator>;

/**
 * Only a project's declared dependencies are read from bun.lock here (including which are
 * workspace members, via a `"workspace:"` specifier). *Resolving* a declared dependency to where it
 * actually lives on disk is done by following bun's own `node_modules` symlinks instead, see
 * bun-isolated.ts: a resolution's store folder name isn't always predictable, e.g. a `file:`
 * dependency's is a hash, not a plain `name@version`.
 */
export type BunLock = {
  workspaces: Record<string, BunLockWorkspace>;
};

export const readBunLock = async (
  workingDirectory: string,
  onVerbose: OnVerbose = noopOnVerbose
): Promise<BunLock> => {
  const path = join(workingDirectory, "bun.lock");

  const doesLockFileExist = await fileExists(path);
  if (!doesLockFileExist) {
    onVerbose(`Cannot find the bun.lock: '${path}'`);
    throw new BunLockError(`Cannot find the file: '${path}'`);
  }

  const contents = await readFile(path, { encoding: "utf8" });

  let parsedContents: unknown;
  try {
    parsedContents = json5Parse<unknown>(contents);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new BunLockError(`Unable to parse bun.lock: ${path}: ${reason}`);
  }

  const bunLock = bunLockValidator.safeParse(parsedContents);
  if (!bunLock.success) {
    throw new BunLockError(`Unable to parse bun.lock: ${path}: ${bunLock.error.message}`);
  }

  return { workspaces: bunLock.data.workspaces };
};
