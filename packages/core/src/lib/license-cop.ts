import { createLicenseChecker } from "./composition-root";
import type { OnVerbose } from "./on-verbose";
import type { CheckLicensesResult } from "./result";

export type LicenseCopOptions = {
  allowedLicenses: string[];
  allowedPackages: string[];
  workingDirectory?: string;
  includeDevDependencies?: boolean;
  devDependenciesOnly?: boolean;
  onVerbose?: OnVerbose;
};

export const checkLicenses = async (options: LicenseCopOptions): Promise<CheckLicensesResult> => {
  const licenseChecker = createLicenseChecker(options.onVerbose);

  return await licenseChecker.check(options);
};
