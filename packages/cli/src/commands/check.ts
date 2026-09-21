import { checkLicenses, resolveCheckOptions, type DevDependenciesMode } from "@license-cop/core";
import { createVerboseLogger, type Io } from "../io";
import { reportFailure } from "../report-failure";
import { reportSuccess } from "../report-success";

export type CheckOptions = {
  directory: string;
  verbose: boolean;
  devDependencies?: DevDependenciesMode | undefined;
};

export const runCheck = async (options: CheckOptions, io: Io): Promise<number> => {
  const { directory, verbose: verboseEnabled, devDependencies } = options;
  const verbose = createVerboseLogger(io, verboseEnabled);

  verbose(`Using directory: ${directory}`);

  const resolved = await resolveCheckOptions(directory, { devDependencies, onVerbose: verbose });
  io.stdout(`Scanning dependencies of: ${resolved.productName}`);

  const result = await checkLicenses(resolved.options);
  const exitCode = result.noLicenses.size > 0 || result.forbiddenLicenses.size > 0 ? 1 : 0;

  if (exitCode === 0) {
    reportSuccess(result, io);
  } else {
    reportFailure(result, io);
  }

  // 0 isn't an error code, so it's just the code
  verbose(`Exiting with code ${exitCode}`);
  return exitCode;
};
