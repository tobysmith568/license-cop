import { stat } from "node:fs/promises";

/**
 * Whether there is a *file* at the path: a directory of the same name doesn't count, which is what
 * every caller (lockfiles, `.pnp.cjs`, `package.json`) is looking for.
 */
export const fileExists = async (path: string): Promise<boolean> => {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
};
