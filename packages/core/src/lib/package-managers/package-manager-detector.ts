import { join } from "node:path";
import type { PackageJsonReader } from "../dependency/package-json-reader";
import type { FileSystem } from "../utils/file-system";
import type { PackageManager, PackageManagerName } from "./package-manager";

/** Exactly one package manager per name, each of which really is the one it's filed under. */
export type KnownPackageManagers = {
  [Name in PackageManagerName]: PackageManager & { name: Name };
};

/** Which is tried first when a project has lock files to go on; lower goes first. */
const lockFilePrecedence: Record<PackageManagerName, number> = {
  yarn: 0,
  pnpm: 1,
  bun: 2,
  npm: 3
};

/** Works out which package manager a project uses. */
export class PackageManagerDetector {
  private readonly candidates: readonly PackageManager[];
  private readonly fallback: PackageManager;

  // Typed by name so that adding a package manager to `PackageManagerName` stops compiling until
  // it's both handed in here and given a place in `lockFilePrecedence`. A project that gives no
  // sign of any gets npm.
  constructor(
    packageManagers: KnownPackageManagers,
    private readonly fileSystem: FileSystem,
    private readonly packageJsonReader: PackageJsonReader
  ) {
    this.candidates = Object.values(packageManagers).sort(
      (a, b) => lockFilePrecedence[a.name] - lockFilePrecedence[b.name]
    );
    this.fallback = packageManagers.npm;
  }

  async detect(workingDirectory: string): Promise<PackageManager> {
    const packageJsonPath = join(workingDirectory, "package.json");
    const packageManagerField =
      await this.packageJsonReader.readPackageManagerField(packageJsonPath);

    if (packageManagerField) {
      const named = this.candidates.find(candidate => candidate.isNamedBy(packageManagerField));

      if (named) {
        return named;
      }
    }

    return await this.detectFromLockFiles(workingDirectory);
  }

  private async detectFromLockFiles(workingDirectory: string): Promise<PackageManager> {
    for (const candidate of this.candidates) {
      for (const lockFile of candidate.lockFiles) {
        const exists = await this.fileSystem.fileExists(join(workingDirectory, lockFile));

        if (exists) {
          return candidate;
        }
      }
    }

    return this.fallback;
  }
}
