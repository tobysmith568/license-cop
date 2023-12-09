import * as deepMerge from "deepmerge";
import logger from "../logger";
import { parseConfig } from "./config";
import { findConfig } from "./find-config";
import { loadParentConfig } from "./load-parent-config";

export const loadConfig = async (rootDir: string) => {
  const foundConfig = await findConfig(rootDir);

  let config = parseConfig(foundConfig);

  while (config.extends) {
    logger.verbose(`Extending config with ${config.extends}`);
    const loadedParentConfig = await loadParentConfig(config.extends, rootDir);
    const parsedParentConfig = parseConfig(loadedParentConfig);

    config = deepMerge(parsedParentConfig, config);
    config.extends = parsedParentConfig.extends;
  }

  return config;
};
