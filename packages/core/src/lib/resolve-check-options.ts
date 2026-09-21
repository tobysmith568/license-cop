import { join } from "node:path";
import { loadConfig } from "./config/load-config";
import { readPackageJson } from "./dependency/package-json";
import { resolveDevDependencyOptions, type DevDependenciesMode } from "./dev-dependencies";
import type { LicenseCopOptions } from "./license-cop";
import { noopOnVerbose, type OnVerbose } from "./on-verbose";

export type ResolveCheckOptionsInput = {
  /** Replaces the dev-dependency settings of the config file when given. */
  devDependencies?: DevDependenciesMode | undefined;
  onVerbose?: OnVerbose;
};

export type ResolvedCheck = {
  /** The name of the project, for saying what's being scanned. */
  productName: string;
  /** Ready to hand to `checkLicenses`. */
  options: LicenseCopOptions;
};

/**
 * Everything needed to check a project before scanning it: reads the project's name and its config
 * file (with anything it extends) and turns them into the options for `checkLicenses`. This is what
 * the `license-cop` command does for a directory, so that library users can do the same without
 * repeating it. Nothing is scanned, so it's quick, and it fails on a bad config before a slow scan.
 */
export const resolveCheckOptions = async (
  directory: string,
  input: ResolveCheckOptionsInput = {}
): Promise<ResolvedCheck> => {
  const { devDependencies, onVerbose = noopOnVerbose } = input;

  const packageJsonPath = join(directory, "package.json");
  const packageJson = await readPackageJson(packageJsonPath, onVerbose);
  const config = await loadConfig(directory, onVerbose);

  const options: LicenseCopOptions = {
    allowedLicenses: config.licenses,
    allowedPackages: config.packages,
    workingDirectory: directory,
    ...resolveDevDependencyOptions(devDependencies, config),
    onVerbose
  };

  return { productName: packageJson.name, options };
};
