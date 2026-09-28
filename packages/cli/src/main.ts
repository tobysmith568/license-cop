import { parseCliArgs } from "./args/parse";
import type { CliInvocation } from "./args/schema";
import { runCheck } from "./commands/check";
import { runInit } from "./commands/init";
import { helpText, versionText } from "./help";
import { defaultIo, type Io } from "./io";
import { reportError } from "./report-error";

export const run = async (
  args: string[],
  io: Io = defaultIo,
  cwd: string = process.cwd()
): Promise<number> => {
  let verbose = false;

  try {
    const invocation = parseCliArgs(args, cwd);
    verbose = "verbose" in invocation && invocation.verbose;

    return await execute(invocation, io);
  } catch (error) {
    return reportError(error, io, verbose);
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
