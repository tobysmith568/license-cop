import { Result } from "arg";
import * as arg from "arg";
import { loadConfig } from "../config/load-config";
import { checkLicenses, LicenseCopOptions } from "../license-cop";
import { argumentsWithAliases, ArgumentsWithAliases } from "./arguments";
import { init } from "./commands/init";
import { printPackageVersion } from "./commands/version";
import { join } from "path";
import { readPackageJson } from "../package-json";
import logger from "../logger";
import { reportFailure } from "./report-failure";
import { reportSuccess } from "./report-success";

type ExitCode = 0 | 1;

export async function main(args: string[]): Promise<void> {
  logger.enableLogging();
  try {
    const exitCode = await cli(args);
    process.exitCode = exitCode;
  } catch (e: unknown) {
    if (e instanceof Error) {
      logger.error(e.message);
    } else {
      logger.error(JSON.stringify(e));
    }

    logger.verbose("\nExiting with error code 1");
    process.exitCode = 1;
  }
}

const cli = async (args: string[]): Promise<ExitCode> => {
  const givenUserInputs = parseUserInputs(args);

  if (givenUserInputs["--verbose"]) {
    logger.enableVerboseLogging();
    logger.verbose("Verbose logging enabled");
  }

  if (givenUserInputs["--version"]) {
    await printPackageVersion();
    return 0;
  }

  const directory = givenUserInputs["--directory"] ?? process.cwd();
  logger.verbose(`Using directory: ${directory}`);

  if (givenUserInputs["--init"]) {
    await init(directory);
    return 0;
  }

  const config = await loadConfig(directory);

  const options: LicenseCopOptions = {
    allowedLicenses: config.licenses,
    allowedPackages: config.packages,

    workingDirectory: directory,
    includeDevDependencies:
      givenUserInputs["--include-dev-dependencies"] ?? config.includeDevDependencies,
    devDependenciesOnly: givenUserInputs["--dev-dependencies-only"] ?? config.devDependenciesOnly
  };

  const productName = await getProductName(directory);
  logger.log(`Scanning dependencies of: ${productName}`);

  const result = await checkLicenses(options);

  if (result.noLicenses.size > 0 || result.forbiddenLicenses.size > 0) {
    reportFailure(result);
    return 1;
  }

  reportSuccess(result);
  return 0;
};

const parseUserInputs = (rawArgs: string[]): Result<ArgumentsWithAliases> => {
  return arg(argumentsWithAliases, {
    argv: rawArgs.slice(2)
  });
};

const getProductName = async (directory: string): Promise<string> => {
  const packageJsonPath = join(directory, "package.json");
  const packageJson = await readPackageJson(packageJsonPath);
  return packageJson.name;
};
