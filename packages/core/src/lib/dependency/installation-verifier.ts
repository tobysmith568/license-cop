import { join } from "node:path";
import { NotInstalledError } from "../not-installed-error";
import type { PackageManager } from "../package-managers/package-manager";
import type { FileSystem } from "../utils/file-system";
import type { PackageJsonReader } from "./package-json-reader";

export type InstalledScope = {
  includeDevDependencies: boolean;
  devDependenciesOnly: boolean;
};

/**
 * Scanning a project that hasn't been installed finds no dependencies and so reports a pass, which
 * is a false one whenever the project does depend on something. A project that declares nothing to
 * scan legitimately has no `node_modules`, so only complain when there's something that should be
 * in it. What counts as "something to scan" follows the dev-dependency options.
 */
export class InstallationVerifier {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly packageJsonReader: PackageJsonReader
  ) {}

  async verify(
    workingDirectory: string,
    packageManager: PackageManager,
    scope: InstalledScope
  ): Promise<void> {
    const packageJsonPath = join(workingDirectory, "package.json");
    const declared = await this.packageJsonReader.readDeclaredDependencies(packageJsonPath);

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

    const isInstalled = await this.fileSystem.directoryExists(
      join(workingDirectory, "node_modules")
    );

    if (isInstalled) {
      return;
    }

    throw new NotInstalledError(
      `The dependencies of this project aren't installed (there is no node_modules in ${workingDirectory}). ` +
        `Run '${packageManager.installCommand}' first. ` +
        "If this is a workspace member, run license-cop from the workspace root instead."
    );
  }
}
