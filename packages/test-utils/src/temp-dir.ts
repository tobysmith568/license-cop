import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type TempDir = {
  path: string;
  /** Writes files relative to the temp dir. Objects are serialized as JSON. */
  write: (files: Record<string, string | object>) => Promise<void>;
  /** Deletes the directory, unless `KEEP_TEMP` is set, in which case its path is logged instead. */
  remove: () => Promise<void>;
};

export type CreateTempDirOptions = {
  /** Start of the directory's name, to make a leftover one recognisable. */
  prefix?: string;
};

/**
 * Set to make every temp dir be created inside this one directory rather than the OS temp dir, so
 * that they can all be found (and, with `KEEP_TEMP`, collected) in one place.
 */
export const tempRootEnvVariable = "LICENSE_COP_TEST_TEMP_DIR";

export const createTempDir = async (options: CreateTempDirOptions = {}): Promise<TempDir> => {
  const { prefix = "license-cop-test-" } = options;

  const root = process.env[tempRootEnvVariable] ?? tmpdir();
  await mkdir(root, { recursive: true });

  const created = await mkdtemp(join(root, prefix));

  // On macOS the temp dir sits behind a /var -> /private/var symlink
  const path = await realpath(created);

  const write = async (files: Record<string, string | object>) => {
    for (const [relativePath, contents] of Object.entries(files)) {
      const fullPath = join(path, relativePath);
      const serialized = typeof contents === "string" ? contents : JSON.stringify(contents);

      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, serialized);
    }
  };

  const remove = async () => {
    if (process.env["KEEP_TEMP"]) {
      process.stdout.write(`Keeping temp dir at ${path}\n`);
      return;
    }

    // Retries because on Windows a just-exited child process can still hold a handle briefly
    await rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };

  return { path, write, remove };
};
