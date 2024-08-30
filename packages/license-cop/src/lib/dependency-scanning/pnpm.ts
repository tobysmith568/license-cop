import { buildDependenciesHierarchy } from "@pnpm/reviewing.dependencies-hierarchy";
import { DependencyType } from "../pnpm-cli/list";
import {
  AllowedPackage,
  CheckLicensesResult,
  ForbiddenLicenseResult,
  LicensedPackage,
  NoLicenseResult
} from "../result";
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

  const foundAllowedPackages = new Set<AllowedPackage>();
  const packagesWithAllowedLicenses = new Set<LicensedPackage>();
  const packagesWithNoLicenses = new Set<NoLicenseResult>();
  const packagesWithForbiddenLicenses = new Set<ForbiddenLicenseResult>();

  // const dependencyType = getDependencyType(devDependenciesOnly, includeDevDependencies);
  // const dependencyStructure = await pnpmCli.list({ workingDirectory, dependencyType });

  const result = await buildDependenciesHierarchy([workingDirectory], {
    depth: Infinity,
    include: {
      dependencies: !devDependenciesOnly,
      devDependencies: includeDevDependencies,
      optionalDependencies: false
    },
    lockfileDir: workingDirectory,
    virtualStoreDirMaxLength: Infinity
  });

  console.log(">>>", JSON.stringify(result));

  return {
    allowedPackages: foundAllowedPackages,
    allowedLicenses: packagesWithAllowedLicenses,
    noLicenses: packagesWithNoLicenses,
    forbiddenLicenses: packagesWithForbiddenLicenses
  };
};

const getDependencyType = (
  devDependenciesOnly: boolean,
  includeDevDependencies: boolean
): DependencyType => {
  if (devDependenciesOnly) {
    return "dev";
  }

  if (includeDevDependencies) {
    return "all";
  }

  return "prod";
};
