import { isAbsolute, join } from "path";
import { npmDependencyScanning } from "./dependency-scanning/npm";
import { DependencyScanningOptions } from "./dependency-scanning/options";
import { getPackageManager } from "./dependency/get-package-manager";
import { CheckLicensesResult } from "./result";

export type LicenseCopOptions = {
  allowedLicenses: string[];
  allowedPackages: string[];
  workingDirectory?: string;
  includeDevDependencies?: boolean;
  devDependenciesOnly?: boolean;
};

export const checkLicenses = async (options: LicenseCopOptions): Promise<CheckLicensesResult> => {
  const fullProjectPath = resolvePath(options.workingDirectory);
  const includeDevDependencies = options.includeDevDependencies ?? false;
  const devDependenciesOnly = options.devDependenciesOnly ?? false;

  const dependencyScanningOptions: DependencyScanningOptions = {
    ...options,
    workingDirectory: fullProjectPath,
    includeDevDependencies,
    devDependenciesOnly
  };

  const packageManager = await getPackageManager(fullProjectPath);

  switch (packageManager) {
    case "pnpm":
      throw new Error("pnpm is not yet supported by license-cop");
    default:
      return npmDependencyScanning(dependencyScanningOptions);
  }
};

const resolvePath = (path?: string): string => {
  if (!path) {
    return process.cwd();
  }

  return isAbsolute(path) ? path : join(process.cwd(), path);
};
