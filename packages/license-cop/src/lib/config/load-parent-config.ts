import { stat } from "fs/promises";
import { join } from "path";
import { findConfig } from "./find-config";

export const loadParentConfig = async (
  parentConfigPath: string,
  rootDir: string
): Promise<unknown> => {
  if (parentConfigPath.startsWith("npm:")) {
    const packageName = parentConfigPath.substring(4);
    return await npmResolution(packageName, rootDir);
  }

  if (parentConfigPath.startsWith("http")) {
    return await httpResolution(parentConfigPath);
  }

  if (await nodeModuleExists(parentConfigPath, rootDir)) {
    return await npmResolution(parentConfigPath, rootDir);
  }

  throw new Error(`Invalid parent config location: ${parentConfigPath}`);
};

const nodeModuleExists = async (packageName: string, rootDir: string) => {
  const packagePath = join(rootDir, "node_modules", packageName);

  const statResult = await stat(packagePath);
  return statResult.isDirectory();
};

const npmResolution = async (packageName: string, rootDir: string) => {
  const packagePath = join(rootDir, "node_modules", packageName);
  return await findConfig(packagePath);
};

const httpResolution = async (url: string) => {
  const response = await fetch(url);
  const fetchedJson = await response.json();

  return fetchedJson;
};
