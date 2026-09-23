import type { LicenseCopOptions, OnVerbose } from "@license-cop/core";
import { join } from "node:path";
import { readProjectName } from "../read-project-name";
import { resolveDevDependencyOptions, type DevDependenciesMode } from "./dev-dependencies";
import { loadConfig } from "./load-config";

export type ResolveCheckOptionsInput = {
  /** Replaces the dev-dependency settings of the config file when given. */
  devDependencies: DevDependenciesMode | undefined;
  onVerbose: OnVerbose;
};

export type ResolvedCheck = {
  /** The name of the project, for saying what's being scanned. */
  productName: string;
  /** Ready to hand to `checkLicenses`. */
  options: LicenseCopOptions;
};

/**
 * Everything needed to check a project before scanning it: reads the project's name and its config
 * file (with anything it extends) and combines them with what the command line asked for into the
 * options for `checkLicenses`. Nothing is scanned, so it's quick, and it fails on a bad config
 * before a slow scan.
 */
export const resolveCheckOptions = async (
  directory: string,
  input: ResolveCheckOptionsInput
): Promise<ResolvedCheck> => {
  const { devDependencies, onVerbose } = input;

  const packageJsonPath = join(directory, "package.json");
  const productName = await readProjectName(packageJsonPath, onVerbose);
  const config = await loadConfig(directory, onVerbose);

  const options: LicenseCopOptions = {
    allowedLicenses: config.licenses,
    allowedPackages: config.packages,
    workingDirectory: directory,
    ...resolveDevDependencyOptions(devDependencies, config),
    onVerbose
  };

  return { productName, options };
};
