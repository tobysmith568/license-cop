import logger from "../logger";
import { joinStringArray } from "../utils/join-string-array";
import {
  ForbiddenLicenseViolation,
  MultipleLicensesViolation,
  NoLicenseViolation,
  Violation
} from "../violations-error";

export const reportViolations = (violations: Set<Violation>): void => {
  logger.error("Issues:");

  if (violations.size === 0) {
    logUnknownViolation();
    return;
  }

  const sortedViolations = sortViolations(violations);

  if (sortedViolations["forbidden-license"].length > 0) {
    logForbiddenLicenseViolations(sortedViolations["forbidden-license"]);
  }

  if (sortedViolations["multiple-licenses"].length > 0) {
    logMultipleLicensesViolations(sortedViolations["multiple-licenses"]);
  }

  if (sortedViolations["no-license"].length > 0) {
    logNoLicenseViolations(sortedViolations["no-license"]);
  }
};

const sortViolations = (violations: Set<Violation>) => {
  const forbiddenLicenses: ForbiddenLicenseViolation[] = [];
  const multipleLicenses: MultipleLicensesViolation[] = [];
  const noLicense: NoLicenseViolation[] = [];

  for (const violation of violations) {
    switch (violation.type) {
      case "forbidden-license":
        forbiddenLicenses.push(violation);
        break;
      case "multiple-licenses":
        multipleLicenses.push(violation);
        break;
      case "no-license":
        noLicense.push(violation);
        break;
      default: {
        const _exhaustiveCheck: never = violation;
        throw new Error(`Unhandled violation type: ${_exhaustiveCheck}`);
      }
    }
  }

  return {
    "forbidden-license": forbiddenLicenses,
    "multiple-licenses": multipleLicenses,
    "no-license": noLicense
  } as const;
};

const logUnknownViolation = (): void => {
  logger.error("\nUnknown. Please report this issue at:");
  logger.error("https://github.com/tobysmith568/license-cop");
};

const logForbiddenLicenseViolations = (violations: ForbiddenLicenseViolation[]): void => {
  logger.error("Packages with forbidden licenses:\n");
  for (const violation of violations) {
    const { packageName, packageVersion, license } = violation;
    logger.error(`${packageName}@${packageVersion} - ${license}`);
  }
};

const logMultipleLicensesViolations = (violations: MultipleLicensesViolation[]) => {
  logger.error(`Packages with multiple licenses:
(You should specify these using the 'packages' option in the config file if you allow them.)"
`);

  for (const violation of violations) {
    const { packageName, packageVersion, licenses } = violation;
    const joinedLicenses = joinStringArray(licenses);
    logger.error(`${packageName}@${packageVersion} - ${joinedLicenses}`);
  }
};

const logNoLicenseViolations = (violations: NoLicenseViolation[]) => {
  logger.error("Packages with no license:\n");
  for (const violation of violations) {
    const { packageName, packageVersion } = violation;
    logger.error(`${packageName}@${packageVersion} - UNLICENSED`);
  }
};
