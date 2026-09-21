import { stat } from "node:fs/promises";

/** Whether there is a *directory* at the path: a file of the same name doesn't count. */
export const directoryExists = async (path: string): Promise<boolean> => {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
};
