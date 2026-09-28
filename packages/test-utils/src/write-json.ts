import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Writes `contents` as JSON to `path`, creating any missing parent directories. */
export const writeJson = async (path: string, contents: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(contents, null, 2));
};
