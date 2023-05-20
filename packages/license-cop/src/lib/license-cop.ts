import { Node, Link } from "@npmcli/arborist";
import * as Arborist from "@npmcli/arborist";
import { isAbsolute, join } from "path";
import logger from "./logger";
import { getLicenseExpression, readPackageJson } from "./package-json";
import { isAllowedPackage } from "./package-rules";
import { calculateIssues } from "./spdx/calculate-issues";
import { joinStringArray } from "./utils/join-string-array";
import { parseLicenseExpression } from "./spdx/parse-license-expression";
import {
  AllowedPackage,
  CheckLicensesResult,
  ForbiddenLicenseResult,
  LicensedPackage,
  NoLicenseResult
} from "./result";

export interface LicenseCopOptions {
  allowedLicenses: string[];
  allowedPackages: string[];
  workingDirectory?: string;
  includeDevDependencies?: boolean;
  devDependenciesOnly?: boolean;
}

export const checkLicenses = async (options: LicenseCopOptions): Promise<CheckLicensesResult> => {
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

  const path = resolvePath(workingDirectory);
  const arborist = new Arborist({ path });

  const topNode = await arborist.loadActual();

  const parseNode = async (node: Node | Link) => {
    logger.verbose(`Parsing node: ${node.name}`);

    const isDevDependency = node.dev || node.devOptional;

    if (!includeDevDependencies && !devDependenciesOnly && isDevDependency) {
      return;
    }

    if (devDependenciesOnly && !isDevDependency) {
      return;
    }

    const packageJsonPath = join(node.realpath, "package.json");
    const packageJson = await readPackageJson(packageJsonPath);

    if (isAllowedPackage(node.name, packageJson.version, allowedPackages)) {
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
      packagesWithForbiddenLicenses.add({
        name: packageJson.name,
        version: packageJson.version,
        licenseIdentifiers: joinedIssues,
        spdxExpression: rawLicenseExpression
      });
    } else {
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

const resolvePath = (path?: string): string => {
  if (!path) {
    return process.cwd();
  }

  return isAbsolute(path) ? path : join(process.cwd(), path);
};
