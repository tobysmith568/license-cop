import Arborist, { Node, Link } from "@npmcli/arborist";
import { isAbsolute, join } from "path";
import { readPackageJson } from "./package-json";
import { isAllowedLicense, isAllowedPackage } from "./package-rules";

export interface LicenseCopOptions {
  allowedLicenses: string[];
  allowedPackages: string[];
  workingDirectory?: string;
  includeDevDependencies?: boolean;
  devDependenciesOnly?: boolean;
}

interface Violation {
  packageName: string;
  packageVersion: string;
  license: string;
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

  const arborist = new Arborist({
    path
  });

  const topNode = await arborist.loadActual();

  console.log("Scanning dependencies of:", topNode.name);

  const parseNodes = async (nodes: IterableIterator<Node | Link>) => {
    for (const node of nodes) {
      const isDevDependency = node.dev || node.devOptional;

      if (!includeDevDependencies && !devDependenciesOnly && isDevDependency) {
        continue;
      }

      if (devDependenciesOnly && !isDevDependency) {
        continue;
      }

      const packageJsonPath = join(node.realpath, "package.json");
      const packageJson = await readPackageJson(packageJsonPath);

      const license = packageJson.license ?? "UNLICENSED";

      allLicenses.add(license);

      if (isAllowedPackage(node.name, packageJson.version, allowedPackages)) {
        continue;
      }

      if (!isAllowedLicense(license, allowedLicenses)) {
        packageViolations.add({
          packageName: node.name,
          packageVersion: packageJson.version,
          license
        });
      }

      if (node.children.size > 0) {
        parseNodes(node.children.values());
      }
    }
  };

  await parseNodes(topNode.children.values());

  if (packageViolations.size > 0) {
    reportViolations(packageViolations);
  } else {
    console.log("No issues found!");
  }
};

const resolvePath = (path?: string): string => {
  if (!path) {
    return process.cwd();
  }

  return isAbsolute(path) ? path : join(process.cwd(), path);
};

const reportViolations = (violations: Set<Violation>): void => {
  console.log("Issues:");
  for (const violation of violations) {
    const { packageName, packageVersion, license } = violation;
    console.log(`${packageName}@${packageVersion} - ${license}`);
  }
};
