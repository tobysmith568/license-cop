import type { FixturePackage } from "./fixtures";
import { fixturePackages, getTarballPath } from "./fixtures";
import type { PackageManager } from "./package-managers";

/**
 * Builds a `package.json` whose dependencies are the locally packed fixture packages, so installing
 * it never touches the registry. A fixture dependency's own dependencies on other fixtures are
 * redirected to the local tarballs too, using each package manager's spelling of "override".
 */
export class PackageJsonBuilder {
  private readonly dependencies: FixturePackage[] = [];
  private readonly devDependencies: FixturePackage[] = [];
  private readonly overridden: FixturePackage[] = [];

  dependsOn(...fixtures: FixturePackage[]): this {
    this.dependencies.push(...fixtures);
    return this;
  }

  devDependsOn(...fixtures: FixturePackage[]): this {
    this.devDependencies.push(...fixtures);
    return this;
  }

  /** Redirects a fixture that is only depended on indirectly (by another fixture) to its tarball. */
  overriding(...fixtures: FixturePackage[]): this {
    this.overridden.push(...fixtures);
    return this;
  }

  async build(packageManager: PackageManager): Promise<object> {
    const dependencies = await toFileSpecifiers(this.dependencies);
    const devDependencies = await toFileSpecifiers(this.devDependencies);
    const overrides = await toFileSpecifiers(this.overridden);

    const packageJson = {
      name: "cli-e2e-project",
      version: "0.0.0",
      private: true,
      dependencies,
      devDependencies
    };

    if (this.overridden.length === 0) {
      return packageJson;
    }

    switch (packageManager) {
      case "npm":
        return { ...packageJson, overrides };
      case "pnpm-10":
      case "pnpm-11":
      case "pnpm-12":
        return { ...packageJson, pnpm: { overrides } };
      case "yarn-1":
      case "yarn-3":
      case "yarn-4":
        return { ...packageJson, resolutions: overrides };
      default: {
        const _exhaustiveCheck: never = packageManager;
        throw new Error(`Unknown package manager: ${_exhaustiveCheck}`);
      }
    }
  }
}

const toFileSpecifiers = async (fixtures: FixturePackage[]) => {
  const specifiers: Record<string, string> = {};

  for (const fixture of fixtures) {
    const tarballPath = await getTarballPath(fixture);
    const forwardSlashPath = tarballPath.replaceAll("\\", "/");

    specifiers[fixturePackages[fixture].name] = `file:${forwardSlashPath}`;
  }

  return specifiers;
};
