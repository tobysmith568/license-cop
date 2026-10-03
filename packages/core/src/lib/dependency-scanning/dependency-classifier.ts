import { isAllowedPackage } from "../dependency/package-rules";
import type { Logger } from "../logging/logger";
import type { CheckLicensesResult } from "../result";
import { calculateIssues } from "../spdx/calculate-issues";
import { parseLicenseExpression } from "../spdx/parse-license-expression";
import { joinStringArray } from "../utils/join-string-array";
import type { NormalizedNode } from "./normalized-node";
import { ResultTally } from "./result-tally";

export interface ClassificationRules {
  allowedLicenses: string[];
  allowedPackages: string[];
}

export interface DependencyClassifier {
  classify(nodes: NormalizedNode[], rules: ClassificationRules): CheckLicensesResult;
}

/** What one `classify` call works with. */
type Run = {
  allowedPackages: string[];
  allowedLicenses: string[];
  tally: ResultTally;
};

/** Sorts every dependency in a tree, and everything beneath it, by what its license allows. */
export class LicenseDependencyClassifier implements DependencyClassifier {
  constructor(private readonly logger: Logger) {}

  classify(nodes: NormalizedNode[], rules: ClassificationRules): CheckLicensesResult {
    const run: Run = {
      allowedPackages: rules.allowedPackages,
      allowedLicenses: rules.allowedLicenses,
      tally: new ResultTally()
    };

    this.classifyNodes(nodes, run);

    return run.tally.toResult();
  }

  private classifyNodes(nodes: NormalizedNode[], run: Run): void {
    for (const node of nodes) {
      this.classifyNode(node, run);
    }
  }

  private classifyNode(node: NormalizedNode, run: Run): void {
    this.classifyOwnLicense(node, run);
    this.classifyNodes(node.children, run);
  }

  private classifyOwnLicense(node: NormalizedNode, run: Run): void {
    const { id, name, packageJson } = node;
    const { allowedPackages, allowedLicenses, tally } = run;
    const packageName = packageJson.name;
    const packageVersion = packageJson.version;

    if (isAllowedPackage(name, packageVersion, allowedPackages)) {
      this.logger.verbose(`Package ${packageName} is an allowed package`);
      tally.addAllowedPackage(id, { name: packageName, version: packageVersion });
      return;
    }

    const rawLicenseExpression = packageJson.licenseExpression;
    const licenseExpression = parseLicenseExpression(rawLicenseExpression);

    if (licenseExpression.type === "unlicensed") {
      this.logger.verbose(`Package ${packageName} is unlicensed`);
      tally.addNoLicense(id, { name: packageName, version: packageVersion });
      return;
    }

    const licenseIssues = calculateIssues(licenseExpression, allowedLicenses);
    const joinedIssues = joinStringArray(licenseIssues);

    if (licenseIssues.length > 0) {
      this.logger.verbose(`Package ${packageName} has the forbidden license: ${joinedIssues}`);
      tally.addForbiddenLicense(id, {
        name: packageName,
        version: packageVersion,
        licenseIdentifiers: joinedIssues,
        spdxExpression: rawLicenseExpression
      });
      return;
    }

    this.logger.verbose(`Package ${packageName} has the allowed license: ${rawLicenseExpression}`);
    tally.addAllowedLicense(id, {
      name: packageName,
      version: packageVersion,
      spdxExpression: rawLicenseExpression,
      licenses: licenseExpression
    });
  }
}
