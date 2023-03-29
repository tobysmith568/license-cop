import arg, { Result } from "arg";
import { checkLicenses } from "../license-cop";
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

  await checkLicenses(givenUserInputs["--directory"]);
};

const parseUserInputs = (rawArgs: string[]): Result<ArgumentsWithAliases> => {
  return arg(argumentsWithAliases, {
    argv: rawArgs.slice(2)
  });
};
