import logger from "../logger";
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
  for (const violation of violations) {
    const { packageName, packageVersion, license } = violation;
    logger.error(`${packageName}@${packageVersion} - ${license}`);
  }
};
