import { githubResolution } from "./parent-resolutions/github";
import { nodeModuleExists, npmResolution } from "./parent-resolutions/npm";
import { httpResolution } from "./parent-resolutions/http";

export const loadParentConfig = async (
  parentConfigPath: string,
  rootDir: string
): Promise<unknown> => {
  if (parentConfigPath.startsWith("npm:")) {
    const packageName = parentConfigPath.substring(4);
    return await npmResolution(packageName, rootDir);
  }

  if (parentConfigPath.startsWith("github:")) {
    const repo = parentConfigPath.substring(7);
    return await githubResolution(repo);
  }

  if (parentConfigPath.startsWith("http")) {
    return await httpResolution(parentConfigPath);
  }

  if (await nodeModuleExists(parentConfigPath, rootDir)) {
    return await npmResolution(parentConfigPath, rootDir);
  }

  throw new Error(`Invalid parent config location: ${parentConfigPath}`);
};
