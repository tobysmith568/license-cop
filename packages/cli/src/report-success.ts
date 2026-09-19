import type { CheckLicensesResult } from "@license-cop/core";
import type { Io } from "./io";

export const reportSuccess = (result: CheckLicensesResult, io: Io): void => {
  const { allowedPackages, allowedLicenses } = result;

  io.stdout("\nDone! No issues found");

  if (allowedPackages.size !== 0) {
    io.stdout(`Found ${allowedPackages.size} allowed packages`);
  }

  if (allowedLicenses.size !== 0) {
    io.stdout(`Found ${allowedLicenses.size} packages with allowed licenses`);
  }
};
