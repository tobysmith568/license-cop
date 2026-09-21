import { ConfigError, searchConfig } from "@license-cop/core";
import { stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createVerboseLogger, type Io } from "../io";

export type InitOptions = {
  directory: string;
  verbose: boolean;
};

const defaultConfig = `{
  "$schema": "https://license-cop.js.org/schema.json",
  "licenses": ["MIT", "ISC", "Apache-2.0"],
  "packages": []
}
`;

export const runInit = async (options: InitOptions, io: Io): Promise<number> => {
  const { directory, verbose: verboseEnabled } = options;
  const verbose = createVerboseLogger(io, verboseEnabled);

  const isDirectory = await stat(directory).then(
    stats => stats.isDirectory(),
    () => false
  );

  if (!isDirectory) {
    io.stderr(`Cannot set up a config file: ${directory} isn't a directory that exists`);
    return 1;
  }

  // Loaded the way a normal run would, so a config counts if license-cop would use it
  const existingConfig = await searchConfig(directory);

  if (existingConfig) {
    throw new ConfigError(`this project already has a config file: ${existingConfig.filepath}`);
  }

  io.stdout("Setting up a new license-cop config file...");

  const configPath = join(directory, ".licenses.json");
  verbose(`Writing config file to: ${configPath}`);
  await writeFile(configPath, defaultConfig);

  io.stdout("Done!");
  io.stdout("Run `npx license-cop` to check your dependencies");

  return 0;
};
