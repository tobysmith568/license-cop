import { readPackageJson } from "@license-cop/core";
import { join } from "node:path";

export const helpText = (): string =>
  `Usage: license-cop [options] [command]

Yet another license checker tool for your dependencies; focused on simplicity

Options:
  -D, --include-dev         Include dev dependencies
  --dev-only                Only check dev dependencies
  --init                    An alias for 'license-cop init'
  --verbose                 Enable verbose logging
  -d, --directory <dir>     The directory of the project. Defaults to the current working directory.
  -v, --version             Print the installed version of license-cop
  -h, --help                Display this help

Commands:
  init                      Create a new license-cop configuration file`;

export const versionText = async (): Promise<string> => {
  const packageJsonLocation = join(__dirname, "../package.json");
  const { version } = await readPackageJson(packageJsonLocation);

  return `v${version}`;
};
