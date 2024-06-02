import { access } from "node:fs/promises";
import { join } from "node:path";
import { readPackageJson } from "./package-json";

export type PackageManager = "npm" | "yarn" | "pnpm";

export const getPackageManager = async (workingDirectory: string): Promise<PackageManager> => {
  const packageJsonPath = join(workingDirectory, "package.json");
  const packageJson = await readPackageJson(packageJsonPath);

  if (packageJson.packageManager) {
    const result = tryResolveFromPackageManager(packageJson.packageManager);
    if (result) {
      return result;
    }
  }

  return await resolveFromLockFileDiscovery(workingDirectory);
};

const tryResolveFromPackageManager = (packageManager: string): PackageManager | undefined => {
  if (packageManager.startsWith("npm")) {
    return "npm";
  }

  if (packageManager.startsWith("yarn")) {
    return "yarn";
  }

  if (packageManager.startsWith("pnpm")) {
    return "pnpm";
  }

  return undefined;
};

const resolveFromLockFileDiscovery = async (workingDirectory: string): Promise<PackageManager> => {
  if (await fileExists(join(workingDirectory, "yarn.lock"))) {
    return "yarn";
  }

  if (await fileExists(join(workingDirectory, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  return "npm";
};

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch (error) {
    return false;
  }
};
