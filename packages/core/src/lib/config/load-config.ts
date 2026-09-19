import deepMerge from "deepmerge";
import { noopOnVerbose, type OnVerbose } from "../on-verbose";
import { parseConfig } from "./config";
import { findConfig } from "./find-config";
import { loadParentConfig } from "./load-parent-config";

export const loadConfig = async (rootDir: string, onVerbose: OnVerbose = noopOnVerbose) => {
  const foundConfig = await findConfig(rootDir);

  let config = parseConfig(foundConfig);

  while (config.extends) {
    onVerbose(`Extending config with ${config.extends}`);
    const loadedParentConfig = await loadParentConfig(config.extends, rootDir, onVerbose);
    const parsedParentConfig = parseConfig(loadedParentConfig);

    config = deepMerge(parsedParentConfig, config);
    config.extends = parsedParentConfig.extends;
  }

  return config;
};
