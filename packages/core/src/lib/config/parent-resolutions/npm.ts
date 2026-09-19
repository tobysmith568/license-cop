import { stat } from "fs/promises";
import { join } from "path";
import { noopOnVerbose, type OnVerbose } from "../../on-verbose";
import { findConfig } from "../find-config";

export const npmResolution = async (
  packageName: string,
  rootDir: string,
  onVerbose: OnVerbose = noopOnVerbose
) => {
  onVerbose(`Resolving npm package: ${packageName}`);

  const packagePath = getPackagePath(rootDir, packageName);
  return await findConfig(packagePath);
};

export const nodeModuleExists = async (packageName: string, rootDir: string) => {
  const packagePath = getPackagePath(rootDir, packageName);

  try {
    const statResult = await stat(packagePath);
    return statResult.isDirectory();
  } catch {
    return false;
  }
};

const getPackagePath = (rootDir: string, packageName: string) =>
  join(rootDir, "node_modules", packageName);
