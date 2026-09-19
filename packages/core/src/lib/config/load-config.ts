import deepMerge from "deepmerge";
import { noopOnVerbose, type OnVerbose } from "../on-verbose";
import { applyConfigDefaults, parseRawConfig, type Config } from "./config";
import { ConfigError } from "./config-error";
import { findConfig } from "./find-config";
import { loadParentConfig } from "./load-parent-config";

export const loadConfig = async (
  rootDir: string,
  onVerbose: OnVerbose = noopOnVerbose
): Promise<Config> => {
  const foundConfig = await findConfig(rootDir);

  let config = parseRawConfig(foundConfig);
  const visitedParents = new Set<string>();

  while (config.extends) {
    const parentLocation = config.extends;

    if (visitedParents.has(parentLocation)) {
      throw new ConfigError(`Circular config extension: ${parentLocation}`);
    }
    visitedParents.add(parentLocation);

    onVerbose(`Extending config with ${parentLocation}`);
    const loadedParentConfig = await loadParentConfig(parentLocation, rootDir, onVerbose);
    const parsedParentConfig = parseRawConfig(loadedParentConfig);

    config = deepMerge(parsedParentConfig, config);
    config.extends = parsedParentConfig.extends;
  }

  return applyConfigDefaults(config);
};
