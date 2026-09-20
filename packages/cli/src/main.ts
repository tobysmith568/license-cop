import { LicenseCopError } from "@license-cop/core";
import { parseCliArgs } from "./args/parse";
import type { CliInvocation } from "./args/schema";
import { runCheck } from "./commands/check";
import { runInit } from "./commands/init";
import { UsageError } from "./errors";
import { helpText, versionText } from "./help";
import { defaultIo, type Io } from "./io";

export const run = async (
  args: string[],
  io: Io = defaultIo,
  cwd: string = process.cwd()
): Promise<number> => {
  try {
    const invocation = parseCliArgs(args, cwd);
    return await execute(invocation, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`error: ${error.message}`);
      io.stderr("Run 'license-cop --help' for usage");
      return 1;
    }

    if (error instanceof LicenseCopError) {
      io.stderr(error.message);
      return 1;
    }

    throw error;
  }
};

const execute = async (invocation: CliInvocation, io: Io): Promise<number> => {
  switch (invocation.kind) {
    case "check":
      return await runCheck(invocation, io);
    case "init":
      return await runInit(invocation, io);
    case "version": {
      const text = await versionText();
      io.stdout(text);
      return 0;
    }
    case "help":
      io.stdout(helpText());
      return 0;
    default: {
      const _exhaustiveCheck: never = invocation;
      throw new Error(`Unknown invocation: ${JSON.stringify(_exhaustiveCheck)}`);
    }
  }
};
