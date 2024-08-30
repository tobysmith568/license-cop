import Arborist = require("@npmcli/arborist");
import { Link, Node } from "@npmcli/arborist";
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

export const npmDependencyScanning = async (
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

  const arborist = new Arborist({ path: workingDirectory });

  const topNode = await arborist.loadActual();

  // This function is very similar to the one in pnpm.ts
  // If you change this, you probably want to change that one too
  const parseNode = async (node: Node | Link) => {
    logger.verbose(`Parsing node: ${node.name}`);

    const isDevDependency = node.dev;

    if (!includeDevDependencies && !devDependenciesOnly && isDevDependency) {
      return;
    }

    if (devDependenciesOnly && !isDevDependency) {
      return;
    }

    const packageJsonPath = join(node.realpath, "package.json");
    const packageJson = await readPackageJson(packageJsonPath);

    if (isAllowedPackage(node.name, packageJson.version, allowedPackages)) {
      logger.verbose(`Package ${packageJson.name} is an allowed package`);
      foundAllowedPackages.add({
        name: packageJson.name,
        version: packageJson.version
      });

      if (node.children.size > 0) {
        await parseNodes(node.children.values());
      }
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

      if (node.children.size > 0) {
        await parseNodes(node.children.values());
      }
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

    if (node.children.size > 0) {
      parseNodes(node.children.values());
    }
  };

  const parseNodes = async (nodes: IterableIterator<Node | Link>) => {
    for (const node of nodes) {
      await parseNode(node);
    }
  };

  await parseNodes(topNode.children.values());

  return {
    allowedPackages: foundAllowedPackages,
    allowedLicenses: packagesWithAllowedLicenses,
    noLicenses: packagesWithNoLicenses,
    forbiddenLicenses: packagesWithForbiddenLicenses
  };
};
