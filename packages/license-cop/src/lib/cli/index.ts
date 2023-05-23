import logger from "../logger";
import { initCommand } from "./commands/init";
import { versionCommand } from "./commands/version";
import { mainCommand } from "./commands/main";

export const main = async (args: string[]): Promise<void> => {
  logger.enableLogging();
  await program.parseAsync(args);
};

const program = mainCommand.addCommand(initCommand).addCommand(versionCommand);
