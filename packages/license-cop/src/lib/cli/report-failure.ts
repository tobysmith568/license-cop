import logger from "../logger";
import { CheckLicensesResult, ForbiddenLicenseResult, NoLicenseResult } from "../result";

export const reportFailure = (result: CheckLicensesResult): void => {
  const { noLicenses, forbiddenLicenses } = result;

  logger.log("Found the following issues...\n");

  if (noLicenses.size > 0) {
    logNoLicenseIssues(noLicenses);
  }

  if (forbiddenLicenses.size > 0) {
    logForbiddenLicenseIssues(forbiddenLicenses);
  }
};

const logNoLicenseIssues = (noLicenseResults: Set<NoLicenseResult>) => {
  logger.error("Packages with no license:");

  for (const result of noLicenseResults.values()) {
    const { name, version } = result;
    logger.error(`${name}@${version}`);
  }

  logger.error("");
};

const logForbiddenLicenseIssues = (forbiddenLicensesResults: Set<ForbiddenLicenseResult>): void => {
  logger.error("Packages with forbidden licenses:");

  for (const result of forbiddenLicensesResults.values()) {
    const { name, version, licenseIdentifiers, spdxExpression } = result;

    const licenseDetails =
      licenseIdentifiers === spdxExpression
        ? licenseIdentifiers
        : `${licenseIdentifiers} from ${spdxExpression}`;

    logger.error(`${name}@${version} - ${licenseDetails}`);
  }
};
