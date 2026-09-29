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

const bunLockValidator = z.object({
  // Keyed by each workspace member's path relative to the lockfile, `""` for the root project
  // itself (present even for a single, non-workspace project).
  workspaces: z.record(z.string(), bunLockWorkspaceValidator),
  // Each value is bun's own tuple shape: `[descriptor, registry, meta, integrity]`, trimmed to
  // just `[descriptor]` for a workspace member. Left as `unknown[]` here and picked apart by
  // `parsePackageEntry`, since a zod tuple can't express that variable length.
  packages: z.record(z.string(), z.array(z.unknown()).min(1))
});

export type BunLockWorkspace = z.infer<typeof bunLockWorkspaceValidator>;

export type BunLockPackage = {
  name: string;
  version: string;
  dependencies: Record<string, string>;
};

export type BunLock = {
  workspaces: Record<string, BunLockWorkspace>;
  /** Keyed the same way bun.lock itself keys them, see `resolveBunLockPackage`. */
  packages: Record<string, BunLockPackage>;
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

  const packages: Record<string, BunLockPackage> = {};
  for (const [key, entry] of Object.entries(bunLock.data.packages)) {
    const parsedEntry = parsePackageEntry(entry, key, path);
    if (parsedEntry) {
      packages[key] = parsedEntry;
    }
  }

  return { workspaces: bunLock.data.workspaces, packages };
};

/**
 * Resolves the package a dependency edge reaching `name` from `ancestorPath` points to. bun
 * qualifies a package's key with its chain of ancestor names only when it needs to (a nested
 * resolution that differs from what an ancestor already settled on, e.g. `is-odd/is-number`),
 * falling back to the bare name otherwise. This mirrors the symlinks bun itself writes under
 * `node_modules/.bun/<name>@<version>/node_modules/<child>`. Confirmed two levels deep by spike;
 * deeper chains are assumed to drop the oldest ancestor first, the same direction pnpm's own
 * dependency-path keys resolve in.
 */
export const resolveBunLockPackage = (
  lock: BunLock,
  ancestorPath: string[],
  name: string
): BunLockPackage | undefined => {
  for (let dropped = 0; dropped <= ancestorPath.length; dropped++) {
    const key = [...ancestorPath.slice(dropped), name].join("/");
    const found = lock.packages[key];

    if (found) {
      return found;
    }
  }

  return undefined;
};

const parsePackageEntry = (entry: unknown[], key: string, path: string): BunLockPackage | undefined => {
  const descriptor = entry[0];

  if (typeof descriptor !== "string") {
    throw new BunLockError(`Unable to parse bun.lock: ${path}: package '${key}' has no descriptor`);
  }

  const separatorIndex = descriptor.lastIndexOf("@");
  const name = separatorIndex > 0 ? descriptor.slice(0, separatorIndex) : descriptor;
  const version = separatorIndex > 0 ? descriptor.slice(separatorIndex + 1) : "";

  // A workspace member's own entry, e.g. `pkg-a@workspace:packages/a`: not an installed dependency
  // with its own license to check, so it's left out, the same as npm.ts/pnpm.ts skip a workspace
  // node itself and only check its dependencies.
  if (version.startsWith("workspace:")) {
    return undefined;
  }

  const meta = entry[2];
  const dependencies =
    meta !== null && typeof meta === "object" && "dependencies" in meta
      ? (meta.dependencies as Record<string, string> | undefined)
      : undefined;

  return { name, version, dependencies: dependencies ?? {} };
};
