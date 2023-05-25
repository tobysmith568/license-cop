import { join } from "path";
import logger from "../../logger";
import { readPackageJson } from "../../package-json";
import { createCommandWithGlobalOptions } from "../create-command";

export const versionCommand = createCommandWithGlobalOptions()
  .name("-v")
  .alias("--version")
  .description("Print the installed version of license-cop")
  .action(async () => {
    await printPackageVersion();
  });

const printPackageVersion = async (): Promise<void> => {
  const packageJsonLocation = join(__dirname, "../../../../package.json");
  const { version } = await readPackageJson(packageJsonLocation);
  logger.log(`v${version}`);
};
