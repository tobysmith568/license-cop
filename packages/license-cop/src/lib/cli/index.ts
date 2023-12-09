import logger from "../logger";
import { initCommand } from "./commands/init";
import { mainCommand } from "./commands/main";
import { versionCommand } from "./commands/version";

export const main = async (args: string[]): Promise<void> => {
  logger.enableLogging();
  await program.parseAsync(args);
};

const program = mainCommand.addCommand(initCommand).addCommand(versionCommand);
