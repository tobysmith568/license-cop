import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

export const helpText = (): string =>
  `Usage: license-cop [options] [command]

Yet another license checker tool for your dependencies; focused on simplicity

Options:
  --dev-dependencies <mode> Which dev dependencies to check: 'include' checks them as well as
                            production dependencies, 'only' checks only them. Defaults to production
                            dependencies only.
  --verbose                 Enable verbose logging
  -d, --directory <dir>     The directory of the project. Defaults to the current working directory.
  -v, --version             Print the installed version of license-cop
  -h, --help                Display this help

Commands:
  init                      Create a new license-cop configuration file`;

export const versionText = async (): Promise<string> => {
  const packageJsonLocation = join(__dirname, "../package.json");
  const contents = await readFile(packageJsonLocation, "utf8");
  const { version } = ownPackageJsonSchema.parse(JSON.parse(contents));

  return `v${version}`;
};

// The CLI's own package.json, which is always there and always valid, unlike a project's
const ownPackageJsonSchema = z.object({ version: z.string() });
