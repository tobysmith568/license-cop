import type {
  CheckLicensesResult,
  ForbiddenLicenseResult,
  NoLicenseResult
} from "@license-cop/core";
import type { Io } from "./io";

export const reportFailure = (result: CheckLicensesResult, io: Io): void => {
  const { noLicenses, forbiddenLicenses } = result;

  io.stderr("Found the following issues...\n");

  if (noLicenses.size > 0) {
    logNoLicenseIssues(noLicenses, io);
  }

  if (forbiddenLicenses.size > 0) {
    logForbiddenLicenseIssues(forbiddenLicenses, io);
  }
};

const logNoLicenseIssues = (noLicenseResults: Set<NoLicenseResult>, io: Io) => {
  io.stderr("Packages with no license:");

  for (const result of noLicenseResults.values()) {
    const { name, version } = result;
    io.stderr(`${name}@${version}`);
  }

  io.stderr("");
};

const logForbiddenLicenseIssues = (
  forbiddenLicensesResults: Set<ForbiddenLicenseResult>,
  io: Io
): void => {
  io.stderr("Packages with forbidden licenses:");

  for (const result of forbiddenLicensesResults.values()) {
    const { name, version, licenseIdentifiers, spdxExpression } = result;

    const licenseDetails =
      licenseIdentifiers === spdxExpression
        ? licenseIdentifiers
        : `${licenseIdentifiers} from ${spdxExpression}`;

    io.stderr(`${name}@${version} - ${licenseDetails}`);
  }
};
