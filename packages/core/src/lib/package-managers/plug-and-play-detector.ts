import { join } from "node:path";
import type { FileSystem } from "../utils/file-system";

// `.pnp.cjs` is what yarn 2+ writes; yarn 2 itself wrote `.pnp.js`
const plugAndPlayFiles = [".pnp.cjs", ".pnp.js"];

/** Yarn's Plug'n'Play installs no `node_modules` at all, just a resolution map and zipped packages. */
export class PlugAndPlayDetector {
  constructor(private readonly fileSystem: FileSystem) {}

  /** The Plug'n'Play file a project has, if it has one. */
  async find(workingDirectory: string): Promise<string | undefined> {
    for (const file of plugAndPlayFiles) {
      const exists = await this.fileSystem.fileExists(join(workingDirectory, file));

      if (exists) {
        return file;
      }
    }

    return undefined;
  }
}
