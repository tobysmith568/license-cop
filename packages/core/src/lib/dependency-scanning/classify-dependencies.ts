import type { PackageJson } from "../dependency/package-json";
import { getLicenseExpression } from "../dependency/package-json";
import { isAllowedPackage } from "../dependency/package-rules";
import type { OnVerbose } from "../on-verbose";
import type {
  AllowedPackage,
  CheckLicensesResult,
  ForbiddenLicenseResult,
  LicensedPackage,
  NoLicenseResult
} from "../result";
import { calculateIssues } from "../spdx/calculate-issues";
import { parseLicenseExpression } from "../spdx/parse-license-expression";
import { joinStringArray } from "../utils/join-string-array";

/**
 * A dependency in a package manager-agnostic shape. Each engine is responsible for walking its own
 * native tree (including any dev-dependency filtering) and producing these.
 */
export interface NormalizedNode {
  /** Identifies the node within a scan, e.g. `name@version`. Used to de-duplicate results. */
  id: string;
  /** The name checked against the allowed packages list. */
  name: string;
  packageJson: PackageJson;
  children: NormalizedNode[];
}

export interface ClassifierOptions {
  allowedLicenses: string[];
  allowedPackages: string[];
  onVerbose: OnVerbose;
}

export const classifyDependencies = (
  nodes: NormalizedNode[],
  options: ClassifierOptions
): CheckLicensesResult => {
  const { allowedLicenses, allowedPackages, onVerbose } = options;

  const foundAllowedPackages = new Map<string, AllowedPackage>();
  const packagesWithAllowedLicenses = new Map<string, LicensedPackage>();
  const packagesWithNoLicenses = new Map<string, NoLicenseResult>();
  const packagesWithForbiddenLicenses = new Map<string, ForbiddenLicenseResult>();

  const classifyOwnLicense = (node: NormalizedNode) => {
    const { id, name, packageJson } = node;
    const packageName = packageJson.name;
    const packageVersion = packageJson.version;

    if (isAllowedPackage(name, packageVersion, allowedPackages)) {
      onVerbose(`Package ${packageName} is an allowed package`);
      foundAllowedPackages.set(id, { name: packageName, version: packageVersion });
      return;
    }

    const rawLicenseExpression = getLicenseExpression(packageJson);
    const licenseExpression = parseLicenseExpression(rawLicenseExpression);

    if (licenseExpression.type === "unlicensed") {
      onVerbose(`Package ${packageName} is unlicensed`);
      packagesWithNoLicenses.set(id, { name: packageName, version: packageVersion });
      return;
    }

    const licenseIssues = calculateIssues(licenseExpression, allowedLicenses);
    const joinedIssues = joinStringArray(licenseIssues);

    if (licenseIssues.length > 0) {
      onVerbose(`Package ${packageName} has the forbidden license: ${joinedIssues}`);
      packagesWithForbiddenLicenses.set(id, {
        name: packageName,
        version: packageVersion,
        licenseIdentifiers: joinedIssues,
        spdxExpression: rawLicenseExpression
      });
      return;
    }

    onVerbose(`Package ${packageName} has the allowed license: ${rawLicenseExpression}`);
    packagesWithAllowedLicenses.set(id, {
      name: packageName,
      version: packageVersion,
      spdxExpression: rawLicenseExpression,
      licenses: licenseExpression
    });
  };

  const classifyNode = (node: NormalizedNode) => {
    classifyOwnLicense(node);
    classifyNodes(node.children);
  };

  const classifyNodes = (nodesToClassify: NormalizedNode[]) => {
    for (const node of nodesToClassify) {
      classifyNode(node);
    }
  };

  classifyNodes(nodes);

  const allowedPackagesFound = foundAllowedPackages.values();
  const allowedLicensesFound = packagesWithAllowedLicenses.values();
  const noLicensesFound = packagesWithNoLicenses.values();
  const forbiddenLicensesFound = packagesWithForbiddenLicenses.values();

  return {
    allowedPackages: new Set(allowedPackagesFound),
    allowedLicenses: new Set(allowedLicensesFound),
    noLicenses: new Set(noLicensesFound),
    forbiddenLicenses: new Set(forbiddenLicensesFound)
  };
};
