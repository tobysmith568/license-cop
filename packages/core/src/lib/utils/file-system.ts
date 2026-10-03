import { readFile, realpath, stat } from "node:fs/promises";

/** The disk questions the rest of the code asks, so that a test can answer them without a disk. */
export interface FileSystem {
  /** Whether there is a *file* at the path: a directory of the same name doesn't count. */
  fileExists(path: string): Promise<boolean>;
  /** Whether there is a *directory* at the path: a file of the same name doesn't count. */
  directoryExists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  realpath(path: string): Promise<string>;
}

export class NodeFileSystem implements FileSystem {
  async fileExists(path: string): Promise<boolean> {
    const stats = await this.statOrUndefined(path);

    return stats?.isFile() ?? false;
  }

  async directoryExists(path: string): Promise<boolean> {
    const stats = await this.statOrUndefined(path);

    return stats?.isDirectory() ?? false;
  }

  async readText(path: string): Promise<string> {
    return await readFile(path, { encoding: "utf8" });
  }

  async realpath(path: string): Promise<string> {
    return await realpath(path);
  }

  private async statOrUndefined(path: string) {
    try {
      return await stat(path);
    } catch {
      return undefined;
    }
  }
}
