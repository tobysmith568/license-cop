import type { CheckLicensesResult } from "@license-cop/core";
import logger from "../logger";

export const reportSuccess = (result: CheckLicensesResult): void => {
  const { allowedPackages, allowedLicenses } = result;

  logger.log("\nDone! No issues found");

  if (allowedPackages.size !== 0) {
    logger.log(`Found ${allowedPackages.size} allowed packages`);
  }

  if (allowedLicenses.size !== 0) {
    logger.log(`Found ${allowedLicenses.size} packages with allowed licenses`);
  }

  logger.verbose("\nExiting with error code 0");
  process.exitCode = 0;
};
