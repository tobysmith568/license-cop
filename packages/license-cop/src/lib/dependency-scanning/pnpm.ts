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

  const foundAllowedPackages = new Map<string, AllowedPackage>();
  const packagesWithAllowedLicenses = new Map<string, LicensedPackage>();
  const packagesWithNoLicenses = new Map<string, NoLicenseResult>();
  const packagesWithForbiddenLicenses = new Map<string, ForbiddenLicenseResult>();

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

    const pkgId = `${node.alias}@${node.version}`;
    const packageJsonPath = join(node.path, "package.json");
    const packageJson = await readPackageJson(packageJsonPath);

    if (isAllowedPackage(packageJson.name, packageJson.version, allowedPackages)) {
      logger.verbose(`Package ${packageJson.name} is an allowed package`);
      foundAllowedPackages.set(pkgId, {
        name: packageJson.name,
        version: packageJson.version
      });

      await parseNodes(node.dependencies);
      return;
    }

    const rawLicenseExpression = getLicenseExpression(packageJson);
    const licenseExpression = parseLicenseExpression(rawLicenseExpression);

    if (licenseExpression.type === "unlicensed") {
      logger.verbose(`Package ${packageJson.name} is unlicensed`);
      packagesWithNoLicenses.set(pkgId, {
        name: packageJson.name,
        version: packageJson.version
      });

      await parseNodes(node.dependencies);
      return;
    }

    const licenseIssues = calculateIssues(licenseExpression, allowedLicenses);
    const joinedIssues = joinStringArray(licenseIssues);

    if (licenseIssues.length > 0) {
      logger.verbose(`Package ${packageJson.name} has the forbidden license: ${joinedIssues}`);
      packagesWithForbiddenLicenses.set(pkgId, {
        name: packageJson.name,
        version: packageJson.version,
        licenseIdentifiers: joinedIssues,
        spdxExpression: rawLicenseExpression
      });
    } else {
      logger.verbose(
        `Package ${packageJson.name} has the allowed license: ${rawLicenseExpression}`
      );
      packagesWithAllowedLicenses.set(pkgId, {
        name: packageJson.name,
        version: packageJson.version,
        spdxExpression: rawLicenseExpression,
        licenses: licenseExpression
      });
    }

    await parseNodes(node.dependencies);
  };

  const parseNodes = async (nodes: PackageNode[] | undefined) => {
    if (!nodes) {
      return;
    }

    for (const node of nodes) {
      await parseNode(node);
    }
  };

  for (const hierarchies of Object.values(dependencyHierarchies)) {
    await parseNodes(hierarchies.dependencies);
    await parseNodes(hierarchies.devDependencies);
    await parseNodes(hierarchies.optionalDependencies);
  }

  return {
    allowedPackages: new Set(foundAllowedPackages.values()),
    allowedLicenses: new Set(packagesWithAllowedLicenses.values()),
    noLicenses: new Set(packagesWithNoLicenses.values()),
    forbiddenLicenses: new Set(packagesWithForbiddenLicenses.values())
  };
};
