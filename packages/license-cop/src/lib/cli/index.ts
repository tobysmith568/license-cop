import arg, { Result } from "arg";
import { loadConfig } from "../config/load-config";
import { checkLicenses, LicenseCopOptions } from "../license-cop";
import { ViolationsError } from "../violations-error";
import { argumentsWithAliases, ArgumentsWithAliases } from "./arguments";
import { init } from "./commands/init";
import { printPackageVersion } from "./commands/version";
import { reportViolations } from "./reportViolations";
import { join } from "path";
import { readPackageJson } from "../package-json";
import logger from "../logger";

export async function main(args: string[]): Promise<void> {
  logger.enableLogging();
  try {
    await cli(args);

    logger.verbose("Exiting with error code 0");
    process.exitCode = 0;
  } catch (e: unknown) {
    if (e instanceof ViolationsError) {
      reportViolations(e.violations);
    } else if (e instanceof Error) {
      logger.error(e.message);
    } else {
      logger.error(JSON.stringify(e));
    }

    logger.verbose("\nExiting with error code 1");
    process.exitCode = 1;
  }
}

const cli = async (args: string[]) => {
  const givenUserInputs = parseUserInputs(args);

  if (givenUserInputs["--verbose"]) {
    logger.enableVerboseLogging();
    logger.verbose("Verbose logging enabled");
  }

  if (givenUserInputs["--version"]) {
    await printPackageVersion();
    return;
  }

  const directory = givenUserInputs["--directory"] ?? process.cwd();
  logger.verbose(`Using directory: ${directory}`);

  if (givenUserInputs["--init"]) {
    await init(directory);
    return;
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

  await checkLicenses(options);

  logger.log("Done! No issues found.");
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
