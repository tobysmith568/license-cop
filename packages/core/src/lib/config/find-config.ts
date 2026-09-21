import {
  cosmiconfig,
  type Options as CosmiconfigOptions,
  type CosmiconfigResult,
  type Loader
} from "cosmiconfig";
import { ConfigError } from "./config-error";
import { json5Parse } from "./parsers/json5";

// cspell:disable-next-line
const moduleNames = ["licenses", "licences", "licensesrc", "licencesrc"];

const generateSearchPlaces = (moduleName: string): string[] => [
  `.${moduleName}`,
  `.${moduleName}.json`,
  `.${moduleName}.jsonc`,
  `.${moduleName}.json5`,
  `.${moduleName}.yaml`,
  `.${moduleName}.yml`,
  `.${moduleName}.js`,
  `.${moduleName}.cjs`,
  `.config/${moduleName}`,
  `.config/${moduleName}.json`,
  `.config/${moduleName}.jsonc`,
  `.config/${moduleName}.json5`,
  `.config/${moduleName}.yaml`,
  `.config/${moduleName}.yml`,
  `.config/${moduleName}.js`,
  `.config/${moduleName}.cjs`,
  `${moduleName}.config.js`,
  `${moduleName}.config.cjs`
];

const searchPlaces: string[] = ["package.json"];

for (const moduleName of moduleNames) {
  searchPlaces.push(...generateSearchPlaces(moduleName));
}

const json5Loader: Loader = (_filepath, content) => Promise.resolve(json5Parse(content));

/**
 * Looks for a config in the directory, loading it the way a normal run would. Resolves to `null`
 * when there isn't one, and throws a `ConfigError` when there is one that can't be loaded. Empty
 * files are skipped, so they don't count as a config.
 */
export const searchConfig = async (rootDir: string): Promise<CosmiconfigResult> => {
  const options: Partial<CosmiconfigOptions> = {
    stopDir: rootDir,
    searchPlaces,
    loaders: {
      ".json": json5Loader,
      ".jsonc": json5Loader,
      ".json5": json5Loader
    }
  };

  const explorer = cosmiconfig("licensecop", options);

  try {
    return await explorer.search(rootDir);
  } catch (e) {
    throw ConfigError.fromUnknown(e);
  }
};

export const findConfig = async (rootDir: string): Promise<unknown> => {
  const result = await searchConfig(rootDir);

  if (!result?.config) {
    throw ConfigError.fromUnknown("No config file found");
  }

  return result.config;
};
