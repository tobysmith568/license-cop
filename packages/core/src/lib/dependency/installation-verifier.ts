import { join } from "node:path";
import type { InstallShape } from "../install-shape";
import { NotInstalledError } from "../not-installed-error";
import type { PackageManager } from "../package-managers/package-manager";
import type { PlugAndPlayDetector } from "../package-managers/plug-and-play-detector";
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
 * in it. What counts as "something to scan" follows the dev-dependency options. What counts as
 * "installed" follows the install shape: most shapes are a `node_modules`, Plug'n'Play's is its
 * resolution map.
 */
export class InstallationVerifier {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly packageJsonReader: PackageJsonReader,
    private readonly plugAndPlayDetector: PlugAndPlayDetector
  ) {}

  async verify(
    workingDirectory: string,
    packageManager: PackageManager,
    installShape: InstallShape,
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

    const isInstalled = await this.isInstalled(workingDirectory, installShape);

    if (isInstalled) {
      return;
    }

    throw new NotInstalledError(
      `The dependencies of this project aren't installed (there is no ${whatInstallingWrites(installShape)} in ${workingDirectory}). ` +
        `Run '${packageManager.installCommand}' first. ` +
        "If this is a workspace member, run license-cop from the workspace root instead."
    );
  }

  private async isInstalled(
    workingDirectory: string,
    installShape: InstallShape
  ): Promise<boolean> {
    if (installShape === "yarn-pnp") {
      const plugAndPlayFile = await this.plugAndPlayDetector.find(workingDirectory);

      return plugAndPlayFile !== undefined;
    }

    return await this.fileSystem.directoryExists(join(workingDirectory, "node_modules"));
  }
}

const whatInstallingWrites = (installShape: InstallShape): string =>
  installShape === "yarn-pnp" ? ".pnp.cjs" : "node_modules";
