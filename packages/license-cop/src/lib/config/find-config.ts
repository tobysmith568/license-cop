import { cosmiconfig, Options as CosmiconfigOptions } from "cosmiconfig";

export const findConfig = async (rootDir: string): Promise<unknown> => {
  const options: CosmiconfigOptions = {
    stopDir: rootDir
  };

  const explorer = cosmiconfig("licenses", options);

  const result = await explorer.search(rootDir);

  if (!result?.config) {
    throw new Error("No config file found");
  }

  return result.config;
};
