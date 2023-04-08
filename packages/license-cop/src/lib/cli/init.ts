import { writeFile } from "fs/promises";
import { join } from "path";

const defaultConfig = `{
  "$schema": "https://license-cop.tobythe.dev/schema.json",
  "licenses": ["MIT", "ISC", "Apache-2.0"],
  "packages": []
}
`;

export const init = async (rootDir: string) => {
  console.log("Setting up a new license-cop config file...");

  const configPath = join(rootDir, ".licenses.json");
  writeFile(configPath, defaultConfig);

  console.log("Done!");
  console.log("Run `npx license-cop` to check your dependencies");
};
