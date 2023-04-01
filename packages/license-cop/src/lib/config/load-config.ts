import { cosmiconfig, Options as CosmiconfigOptions } from "cosmiconfig";
import { parseConfig } from "./config";

export const loadConfig = async (rootDir: string) => {
  const options: CosmiconfigOptions = {
    stopDir: rootDir
  };

  const explorer = cosmiconfig("licenses", options);

  const result = await explorer.search(rootDir);

  if (!result?.config) {
    throw new Error("No config file found");
  }

  return parseConfig(result.config);
};
