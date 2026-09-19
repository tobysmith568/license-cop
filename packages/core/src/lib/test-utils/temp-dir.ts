import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type TempDir = {
  path: string;
  /** Writes files relative to the temp dir. Objects are serialized as JSON. */
  write: (files: Record<string, string | object>) => Promise<void>;
  remove: () => Promise<void>;
};

export const createTempDir = async (): Promise<TempDir> => {
  const path = await mkdtemp(join(tmpdir(), "license-cop-test-"));

  const write = async (files: Record<string, string | object>) => {
    for (const [relativePath, contents] of Object.entries(files)) {
      const fullPath = join(path, relativePath);
      const serialized = typeof contents === "string" ? contents : JSON.stringify(contents);

      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, serialized);
    }
  };

  const remove = async () => {
    await rm(path, { recursive: true, force: true });
  };

  return { path, write, remove };
};
