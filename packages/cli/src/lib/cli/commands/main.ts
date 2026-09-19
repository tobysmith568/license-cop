import {
  ConfigError,
  checkLicenses,
  loadConfig,
  readPackageJson,
  type LicenseCopOptions
} from "@license-cop/core";
import { join } from "path";
import logger from "../../logger";
import { createCommandWithGlobalOptions } from "../create-command";
import { reportFailure } from "../report-failure";
import { reportSuccess } from "../report-success";
import { initCommandAction } from "./init";

export const mainCommand = createCommandWithGlobalOptions()
  .name("license-cop")
  .description("Yet another license checker tool for your dependencies; focused on simplicity")
  .option("-D,--include-dev", "Include dev dependencies", false)
  .option("--dev-only", "Only check dev dependencies", false)
  .option("--init", "An alias for 'license-cop init'", false)
  .action(async options => {
    const { directory, includeDev, devOnly } = options;

    if (options.init) {
      await initCommandAction(directory);
      return;
    }

    try {
      await runLicenseCop(directory, includeDev, devOnly);
    } catch (e) {
      if (e instanceof ConfigError) {
        logger.error(e.message);
        process.exitCode = 1;
        return;
      }
      throw e;
    }
  });

const runLicenseCop = async (
  directory: string,
  includeDevDependencies: boolean,
  devDependenciesOnly: boolean
) => {
  logger.verbose(`Using directory: ${directory}`);

  const productName = await getProductName(directory);
  logger.log(`Scanning dependencies of: ${productName}`);

  const config = await loadConfig(directory, logger.verbose);

  const options: LicenseCopOptions = {
    allowedLicenses: config.licenses,
    allowedPackages: config.packages,

    workingDirectory: directory,
    includeDevDependencies: includeDevDependencies || config.includeDevDependencies,
    devDependenciesOnly: devDependenciesOnly || config.devDependenciesOnly,
    onVerbose: logger.verbose
  };

  const result = await checkLicenses(options);

  if (result.noLicenses.size > 0 || result.forbiddenLicenses.size > 0) {
    reportFailure(result);
    process.exitCode = 1;
  } else {
    reportSuccess(result);
  }
};

const getProductName = async (directory: string): Promise<string> => {
  const packageJsonPath = join(directory, "package.json");
  const packageJson = await readPackageJson(packageJsonPath, logger.verbose);
  return packageJson.name;
};
