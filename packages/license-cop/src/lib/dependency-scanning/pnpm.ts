import {
  buildDependenciesHierarchy,
  type PackageNode
} from "@pnpm/reviewing.dependencies-hierarchy";
import { join } from "node:path";
import { getLicenseExpression, readPackageJson } from "../dependency/package-json";
import { isAllowedPackage } from "../dependency/package-rules";
import logger from "../logger";
import {
  AllowedPackage,
  CheckLicensesResult,
  ForbiddenLicenseResult,
  LicensedPackage,
  NoLicenseResult
} from "../result";
import { calculateIssues } from "../spdx/calculate-issues";
import { parseLicenseExpression } from "../spdx/parse-license-expression";
import { joinStringArray } from "../utils/join-string-array";
import { DependencyScanningOptions } from "./options";

const emptyPackageNodes: PackageNode[] = [];

export const pnpmDependencyScanning = async (
  options: DependencyScanningOptions
): Promise<CheckLicensesResult> => {
  const {
    workingDirectory,
    allowedLicenses,
    allowedPackages,
    includeDevDependencies,
    devDependenciesOnly
  } = options;

  const foundAllowedPackages = new Set<AllowedPackage>();
  const packagesWithAllowedLicenses = new Set<LicensedPackage>();
  const packagesWithNoLicenses = new Set<NoLicenseResult>();
  const packagesWithForbiddenLicenses = new Set<ForbiddenLicenseResult>();

  const dependencyHierarchies = await buildDependenciesHierarchy([workingDirectory], {
    depth: Infinity,
    include: {
      dependencies: !devDependenciesOnly,
      devDependencies: includeDevDependencies,
      optionalDependencies: false
    },
    lockfileDir: workingDirectory,
    virtualStoreDirMaxLength: Infinity
  });

  // This function is very similar to the one in npm.ts
  // If you change this, you probably want to change that one too
  const parseNode = async (node: PackageNode) => {
    logger.verbose(`Parsing node: ${node.name}`);

    const packageJsonPath = join(node.path, "package.json");
    const packageJson = await readPackageJson(packageJsonPath);

    if (isAllowedPackage(packageJson.name, packageJson.version, allowedPackages)) {
      logger.verbose(`Package ${packageJson.name} is an allowed package`);
      foundAllowedPackages.add({
        name: packageJson.name,
        version: packageJson.version
      });
      return;
    }

    const rawLicenseExpression = getLicenseExpression(packageJson);
    const licenseExpression = parseLicenseExpression(rawLicenseExpression);

    if (licenseExpression.type === "unlicensed") {
      logger.verbose(`Package ${packageJson.name} is unlicensed`);
      packagesWithNoLicenses.add({
        name: packageJson.name,
        version: packageJson.version
      });
      return;
    }

    const licenseIssues = calculateIssues(licenseExpression, allowedLicenses);
    const joinedIssues = joinStringArray(licenseIssues);

    if (licenseIssues.length > 0) {
      logger.verbose(`Package ${packageJson.name} has the forbidden license: ${joinedIssues}`);
      packagesWithForbiddenLicenses.add({
        name: packageJson.name,
        version: packageJson.version,
        licenseIdentifiers: joinedIssues,
        spdxExpression: rawLicenseExpression
      });
    } else {
      logger.verbose(
        `Package ${packageJson.name} has the allowed license: ${rawLicenseExpression}`
      );
      packagesWithAllowedLicenses.add({
        name: packageJson.name,
        version: packageJson.version,
        spdxExpression: rawLicenseExpression,
        licenses: licenseExpression
      });
    }
  };

  for (const hierarchies of Object.values(dependencyHierarchies)) {
    for (const dep of hierarchies.dependencies ?? emptyPackageNodes) {
      await parseNode(dep);
    }
    for (const dep of hierarchies.devDependencies ?? emptyPackageNodes) {
      await parseNode(dep);
    }
    for (const dep of hierarchies.optionalDependencies ?? emptyPackageNodes) {
      await parseNode(dep);
    }
    for (const dep of hierarchies.unsavedDependencies ?? emptyPackageNodes) {
      await parseNode(dep);
    }
  }

  return {
    allowedPackages: foundAllowedPackages,
    allowedLicenses: packagesWithAllowedLicenses,
    noLicenses: packagesWithNoLicenses,
    forbiddenLicenses: packagesWithForbiddenLicenses
  };
};
