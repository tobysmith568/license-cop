import { writeFile } from "fs/promises";
import { join } from "path";
import logger from "../logger";

const defaultConfig = `{
  "$schema": "https://license-cop.tobythe.dev/schema.json",
  "licenses": ["MIT", "ISC", "Apache-2.0"],
  "packages": []
}
`;

export const init = async (rootDir: string) => {
  logger.log("Setting up a new license-cop config file...");

  const configPath = join(rootDir, ".licenses.json");
  logger.verbose(`Writing config file to: ${configPath}`);
  await writeFile(configPath, defaultConfig);

  logger.log("Done!");
  logger.log("Run `npx license-cop` to check your dependencies");
};
