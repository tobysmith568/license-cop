import { isAbsolute, join } from "node:path";
import type { DependencyScanningOptions } from "./dependency-scanning/dependency-scanning-engine";
import type { LicenseCopOptions } from "./license-cop";

/** Turns what a caller asked for into what a scan needs: every option filled in. */
export class OptionsNormalizer {
  constructor(private readonly currentDirectory: () => string) {}

  normalize(options: LicenseCopOptions): DependencyScanningOptions {
    return {
      allowedLicenses: options.allowedLicenses,
      allowedPackages: options.allowedPackages,
      workingDirectory: this.resolvePath(options.workingDirectory),
      includeDevDependencies: options.includeDevDependencies ?? false,
      devDependenciesOnly: options.devDependenciesOnly ?? false
    };
  }

  private resolvePath(path?: string): string {
    const current = this.currentDirectory();

    if (!path) {
      return current;
    }

    return isAbsolute(path) ? path : join(current, path);
  }
}
