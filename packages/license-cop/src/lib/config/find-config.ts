import { cosmiconfig, Options as CosmiconfigOptions, Loader } from "cosmiconfig";
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

export const findConfig = async (rootDir: string): Promise<unknown> => {
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
    const result = await explorer.search(rootDir);

    if (!result?.config) {
      throw new Error("No config file found");
    }

    return result.config;
  } catch (e) {
    throw ConfigError.fromUnknown(e);
  }
};
