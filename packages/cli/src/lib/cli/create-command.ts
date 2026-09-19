import { Command } from "@commander-js/extra-typings";
import logger from "../logger";

export const createCommandWithGlobalOptions = () =>
  new Command()
    .option("--verbose", "Enable verbose logging")
    .option(
      "-d,--directory <directory>",
      "The directory of the project. Defaults to the current working directory.",
      process.cwd()
    )
    .hook("preAction", thisCommand => {
      const { verbose } = thisCommand.opts();

      if (verbose) {
        logger.enableVerboseLogging();
      }
    });
