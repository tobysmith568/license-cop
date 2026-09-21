import { isAbsolute, join } from "path";
import { npmDependencyScanning } from "./dependency-scanning/npm";
import type { DependencyScanner, DependencyScanningOptions } from "./dependency-scanning/options";
import { pnpmDependencyScanning } from "./dependency-scanning/pnpm";
import { assertInstalled } from "./dependency/assert-installed";
import { getPackageManager, type PackageManager } from "./dependency/get-package-manager";
import { assertNotPlugAndPlay } from "./dependency/plug-and-play";
import { noopOnVerbose, type OnVerbose } from "./on-verbose";
import type { CheckLicensesResult } from "./result";

export type LicenseCopOptions = {
  allowedLicenses: string[];
  allowedPackages: string[];
  workingDirectory?: string;
  includeDevDependencies?: boolean;
  devDependenciesOnly?: boolean;
  onVerbose?: OnVerbose;
};

// Yarn shares npm's `node_modules` layout, so it's read by the same engine. A `Record` rather than a
// `switch` with a default, so that a new package manager can't silently fall through to npm's.
const scanners: Record<PackageManager, DependencyScanner> = {
  npm: npmDependencyScanning,
  yarn: npmDependencyScanning,
  pnpm: pnpmDependencyScanning
};

export const checkLicenses = async (options: LicenseCopOptions): Promise<CheckLicensesResult> => {
  const fullProjectPath = resolvePath(options.workingDirectory);
  const includeDevDependencies = options.includeDevDependencies ?? false;
  const devDependenciesOnly = options.devDependenciesOnly ?? false;
  const onVerbose = options.onVerbose ?? noopOnVerbose;

  const dependencyScanningOptions: DependencyScanningOptions = {
    ...options,
    workingDirectory: fullProjectPath,
    includeDevDependencies,
    devDependenciesOnly,
    onVerbose
  };

  const packageManager = await getPackageManager(fullProjectPath, onVerbose);

  if (packageManager === "yarn") {
    await assertNotPlugAndPlay(fullProjectPath);
  }

  await assertInstalled(fullProjectPath, packageManager, dependencyScanningOptions, onVerbose);

  const scan = scanners[packageManager];

  return scan(dependencyScanningOptions);
};

const resolvePath = (path?: string): string => {
  if (!path) {
    return process.cwd();
  }

  return isAbsolute(path) ? path : join(process.cwd(), path);
};
