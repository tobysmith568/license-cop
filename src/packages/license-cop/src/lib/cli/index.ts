import arg, { Result } from "arg";
import { loadConfig } from "../config/load-config";
import { checkLicenses, LicenseCopOptions } from "../license-cop";
import { argumentsWithAliases, ArgumentsWithAliases } from "./arguments";
import { init } from "./init";
import { printPackageVersion } from "./version";

export async function main(args: string[]): Promise<void> {
  try {
    await cli(args);
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error(e.message);
    } else {
      console.error(e);
    }

    process.exitCode = 1;
  }
}

const cli = async (args: string[]) => {
  const givenUserInputs = parseUserInputs(args);

  if (givenUserInputs["--version"]) {
    await printPackageVersion();
    return;
  }

  const directory = givenUserInputs["--directory"] ?? process.cwd();

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

  await checkLicenses(options);
};

const parseUserInputs = (rawArgs: string[]): Result<ArgumentsWithAliases> => {
  return arg(argumentsWithAliases, {
    argv: rawArgs.slice(2)
  });
};
