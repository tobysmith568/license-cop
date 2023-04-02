import { stat } from "fs/promises";
import { join } from "path";
import { findConfig } from "../find-config";

export const npmResolution = async (packageName: string, rootDir: string) => {
  const packagePath = getPackagePath(rootDir, packageName);
  return await findConfig(packagePath);
};

export const nodeModuleExists = async (packageName: string, rootDir: string) => {
  const packagePath = getPackagePath(rootDir, packageName);

  const statResult = await stat(packagePath);
  return statResult.isDirectory();
};

const getPackagePath = (rootDir: string, packageName: string) =>
  join(rootDir, "node_modules", packageName);
