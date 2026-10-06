import type { InstallShape } from "../install-shape";

export type PackageManagerName = "npm" | "yarn" | "pnpm" | "bun";

/** One package manager's identity, independent of how any one install of it is laid out. */
export abstract class PackageManager {
  abstract readonly name: PackageManagerName;
  abstract readonly installCommand: string;

  /** Files only this package manager writes, which a project that uses it will have. */
  abstract readonly lockFiles: readonly string[];

  /** Which shape this project's install has, which only the project itself can tell. */
  abstract detectInstallShape(workingDirectory: string): Promise<InstallShape>;

  /** Whether a package.json's `packageManager` field (e.g. `pnpm@10.0.0`) names this one. */
  isNamedBy(packageManagerField: string): boolean {
    return packageManagerField.startsWith(this.name);
  }
}
