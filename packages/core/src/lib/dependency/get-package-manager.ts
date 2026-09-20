import { join } from "node:path";
import { noopOnVerbose, type OnVerbose } from "../on-verbose";
import { fileExists } from "../utils/file-exists";
import { readPackageManagerField } from "./package-json";

export type PackageManager = "npm" | "yarn" | "pnpm";

export const getPackageManager = async (
  workingDirectory: string,
  onVerbose: OnVerbose = noopOnVerbose
): Promise<PackageManager> => {
  const packageJsonPath = join(workingDirectory, "package.json");
  const packageManagerField = await readPackageManagerField(packageJsonPath, onVerbose);

  if (packageManagerField) {
    const result = tryResolveFromPackageManager(packageManagerField);
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
