import { noopOnVerbose, type OnVerbose } from "../on-verbose";
import { ConfigError } from "./config-error";
import { githubResolution } from "./parent-resolutions/github";
import { httpResolution } from "./parent-resolutions/http";
import { nodeModuleExists, npmResolution } from "./parent-resolutions/npm";

export const loadParentConfig = async (
  parentConfigPath: string,
  rootDir: string,
  onVerbose: OnVerbose = noopOnVerbose
): Promise<unknown> => {
  if (parentConfigPath.startsWith("npm:")) {
    const packageName = parentConfigPath.substring(4);
    return await npmResolution(packageName, rootDir, onVerbose);
  }

  if (parentConfigPath.startsWith("github:")) {
    const repo = parentConfigPath.substring(7);
    return await githubResolution(repo, onVerbose);
  }

  if (parentConfigPath.startsWith("http")) {
    return await httpResolution(parentConfigPath, onVerbose);
  }

  if (await nodeModuleExists(parentConfigPath, rootDir)) {
    return await npmResolution(parentConfigPath, rootDir, onVerbose);
  }

  throw new ConfigError(`Invalid parent config location: ${parentConfigPath}`);
};
