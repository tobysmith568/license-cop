import { Node, Link } from "@npmcli/arborist";
import * as Arborist from "@npmcli/arborist";
import { isAbsolute, join } from "path";
import logger from "./logger";
import { getLicenseExpression, readPackageJson } from "./package-json";
import { isAllowedLicense, isAllowedPackage } from "./package-rules";
import { Violation, ViolationsError } from "./violations-error";

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

  const allLicenses = new Set<string>();
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

    const licenseOrViolation = getLicenseExpression(packageJson);

    if (typeof licenseOrViolation !== "string") {
      packageViolations.add(licenseOrViolation);
      return;
    }

    allLicenses.add(licenseOrViolation);

    if (isAllowedPackage(node.name, packageJson.version, allowedPackages)) {
      if (node.children.size > 0) {
        await parseNodes(node.children.values());
      }
      return;
    }

    if (!isAllowedLicense(licenseOrViolation, allowedLicenses)) {
      packageViolations.add({
        type: "forbidden-license",
        packageName: node.name,
        packageVersion: packageJson.version,
        license: licenseOrViolation
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
    throw new ViolationsError(packageViolations);
  }
};

const resolvePath = (path?: string): string => {
  if (!path) {
    return process.cwd();
  }

  return isAbsolute(path) ? path : join(process.cwd(), path);
};
