import arg, { Result } from "arg";
import { checkLicenses, LicenseCopOptions } from "../license-cop";
import { argumentsWithAliases, ArgumentsWithAliases } from "./arguments";
import { printPackageVersion } from "./version";

export async function main(args: string[]): Promise<void> {
  try {
    await cli(args);
  } catch (e: unknown) {
    console.error(e);
    process.exitCode = 1;
  }
}

const cli = async (args: string[]) => {
  const givenUserInputs = parseUserInputs(args);

  if (givenUserInputs["--version"]) {
    await printPackageVersion();
    return;
  }

  const options: LicenseCopOptions = {
    workingDirectory: givenUserInputs["--directory"],
    includeDevDependencies: givenUserInputs["--include-dev-dependencies"],
    devDependenciesOnly: givenUserInputs["--dev-dependencies-only"]
  };

  await checkLicenses(options);
};

const parseUserInputs = (rawArgs: string[]): Result<ArgumentsWithAliases> => {
  return arg(argumentsWithAliases, {
    argv: rawArgs.slice(2)
  });
};
