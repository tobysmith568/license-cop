import {
  checkLicenses,
  loadConfig,
  readPackageJson,
  type LicenseCopOptions,
  type OnVerbose
} from "@license-cop/core";
import { join } from "node:path";
import type { DevDependenciesMode } from "../args/schema";
import { createVerboseLogger, type Io } from "../io";
import { reportFailure } from "../report-failure";
import { reportSuccess } from "../report-success";
import { resolveDevDependencyOptions } from "./dev-dependencies";

export type CheckOptions = {
  directory: string;
  verbose: boolean;
  devDependencies?: DevDependenciesMode | undefined;
};

export const runCheck = async (options: CheckOptions, io: Io): Promise<number> => {
  const { directory, verbose: verboseEnabled, devDependencies } = options;
  const verbose = createVerboseLogger(io, verboseEnabled);

  verbose(`Using directory: ${directory}`);

  const productName = await getProductName(directory, verbose);
  io.stdout(`Scanning dependencies of: ${productName}`);

  const config = await loadConfig(directory, verbose);

  const checkOptions: LicenseCopOptions = {
    allowedLicenses: config.licenses,
    allowedPackages: config.packages,

    workingDirectory: directory,
    ...resolveDevDependencyOptions(devDependencies, config),
    onVerbose: verbose
  };

  const result = await checkLicenses(checkOptions);

  if (result.noLicenses.size > 0 || result.forbiddenLicenses.size > 0) {
    reportFailure(result, io);
    return 1;
  }

  reportSuccess(result, io);
  verbose("\nExiting with error code 0");
  return 0;
};

const getProductName = async (directory: string, verbose: OnVerbose): Promise<string> => {
  const packageJsonPath = join(directory, "package.json");
  const packageJson = await readPackageJson(packageJsonPath, verbose);
  return packageJson.name;
};
