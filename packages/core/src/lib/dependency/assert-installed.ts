import { join } from "node:path";
import { NotInstalledError } from "../not-installed-error";
import { noopOnVerbose, type OnVerbose } from "../on-verbose";
import { directoryExists } from "../utils/directory-exists";
import type { PackageManager } from "./get-package-manager";
import { readDeclaredDependencies } from "./package-json";

export type InstalledScope = {
  includeDevDependencies: boolean;
  devDependenciesOnly: boolean;
};

const installCommands: Record<PackageManager, string> = {
  npm: "npm install",
  yarn: "yarn install",
  pnpm: "pnpm install"
};

/**
 * Scanning a project that hasn't been installed finds no dependencies and so reports a pass, which
 * is a false one whenever the project does depend on something. A project that declares nothing to
 * scan legitimately has no `node_modules`, so only complain when there's something that should be
 * in it. What counts as "something to scan" follows the dev-dependency options.
 */
export const assertInstalled = async (
  workingDirectory: string,
  packageManager: PackageManager,
  scope: InstalledScope,
  onVerbose: OnVerbose = noopOnVerbose
): Promise<void> => {
  const packageJsonPath = join(workingDirectory, "package.json");
  const declared = await readDeclaredDependencies(packageJsonPath, onVerbose);

  const toScan = scope.devDependenciesOnly
    ? declared.devDependencies
    : [
        ...declared.dependencies,
        ...declared.optionalDependencies,
        ...(scope.includeDevDependencies ? declared.devDependencies : [])
      ];

  if (toScan.length === 0) {
    return;
  }

  const isInstalled = await directoryExists(join(workingDirectory, "node_modules"));

  if (isInstalled) {
    return;
  }

  throw new NotInstalledError(
    `The dependencies of this project aren't installed (there is no node_modules in ${workingDirectory}). ` +
      `Run '${installCommands[packageManager]}' first. ` +
      "If this is a workspace member, run license-cop from the workspace root instead."
  );
};
