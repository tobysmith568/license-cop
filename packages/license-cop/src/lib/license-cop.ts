import { Node, Link } from "@npmcli/arborist";
import * as Arborist from "@npmcli/arborist";
import { isAbsolute, join } from "path";
import logger from "./logger";
import { getLicenseExpression, readPackageJson } from "./package-json";
import { isAllowedPackage } from "./package-rules";
import { Violation, ViolationsError } from "./violations-error";
import { calculateViolations } from "./spdx/calculate-violations";
import { joinStringArray } from "./utils/join-string-array";
import { parseLicenseExpression } from "./spdx/parse-license-expression";

export interface LicenseCopOptions {
  allowedLicenses: string[];
  allowedPackages: string[];
  workingDirectory?: string;
  includeDevDependencies?: boolean;
  devDependenciesOnly?: boolean;
}

export const checkLicenses = async (options: LicenseCopOptions): Promise<void> => {
  const {
    workingDirectory,
    allowedLicenses,
    allowedPackages,
    includeDevDependencies,
    devDependenciesOnly
  } = options;

  const packageViolations = new Set<Violation>();

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
      if (node.children.size > 0) {
        await parseNodes(node.children.values());
      }
      return;
    }

    const rawLicenseExpression = getLicenseExpression(packageJson);
    const licenseExpression = parseLicenseExpression(rawLicenseExpression);

    if (licenseExpression.type === "unlicensed") {
      packageViolations.add({
        type: "no-license",
        packageName: node.name,
        packageVersion: packageJson.version
      });
      return;
    }

    const licenseViolations = calculateViolations(licenseExpression, allowedLicenses);
    const isMissingOnlyLicense =
      licenseExpression.type === "identifier" &&
      licenseViolations.length === 1 &&
      licenseViolations[0] === licenseExpression.value;

    if (isMissingOnlyLicense) {
      packageViolations.add({
        type: "forbidden-license",
        packageName: node.name,
        packageVersion: packageJson.version,
        license: licenseExpression.value
      });
    } else if (licenseViolations.length > 0) {
      const joinedViolations = joinStringArray(licenseViolations);
      packageViolations.add({
        type: "forbidden-license",
        packageName: node.name,
        packageVersion: packageJson.version,
        license: `${joinedViolations} from ${rawLicenseExpression}`
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

  if (packageViolations.size > 0) {
    // TODO: should probably return a nice model instead
    // TODO: finding license issues isn't an unexpected error
    throw new ViolationsError(packageViolations);
  }
};

const resolvePath = (path?: string): string => {
  if (!path) {
    return process.cwd();
  }

  return isAbsolute(path) ? path : join(process.cwd(), path);
};
