import { access } from "node:fs/promises";
import { join } from "node:path";
import { UnsupportedProjectError } from "../unsupported-project-error";

// `.pnp.cjs` is what yarn 2+ writes; yarn 2 itself wrote `.pnp.js`
const plugAndPlayFiles = [".pnp.cjs", ".pnp.js"];

/**
 * Yarn's Plug'n'Play installs no `node_modules` at all, and scanning one would find no
 * dependencies and so report a pass. Refuse instead, until it's supported.
 */
export const assertNotPlugAndPlay = async (workingDirectory: string): Promise<void> => {
  for (const file of plugAndPlayFiles) {
    if (await fileExists(join(workingDirectory, file))) {
      throw new UnsupportedProjectError(
        `This project uses Yarn Plug'n'Play (found ${file}), which license-cop doesn't support yet. ` +
          "Set 'nodeLinker: node-modules' in .yarnrc.yml and run 'yarn install' again."
      );
    }
  }
};

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch (_error) {
    return false;
  }
};
