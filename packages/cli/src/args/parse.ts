import { parseArgs, type ParseArgsConfig } from "node:util";
import type { z } from "zod";
import { UsageError } from "../errors";
import { cliInvocationSchema, type CliInvocation } from "./schema";

const removedFlagHints: Record<string, string> = {
  "--init": "the --init flag has been removed, use 'license-cop init' instead",
  "-D": "the -D flag has been removed, use '--dev-dependencies include' instead",
  "--include-dev":
    "the --include-dev flag has been removed, use '--dev-dependencies include' instead",
  "--dev-only": "the --dev-only flag has been removed, use '--dev-dependencies only' instead"
};

export const cliOptions = {
  directory: { type: "string", short: "d" },
  verbose: { type: "boolean" },
  "dev-dependencies": { type: "string" },
  version: { type: "boolean", short: "v" },
  help: { type: "boolean", short: "h" }
} as const satisfies ParseArgsConfig["options"];

export const parseCliArgs = (args: string[], defaultDirectory: string): CliInvocation => {
  throwIfRemovedFlag(args);

  const tokens = tokenize(args);
  const candidate = toCandidate(tokens, defaultDirectory);

  // What each value may be, and what may go with what, is the schema's to say
  const result = cliInvocationSchema.safeParse(candidate);

  if (!result.success) {
    throw new UsageError(firstMessage(result.error));
  }

  return result.data;
};

const throwIfRemovedFlag = (args: string[]) => {
  for (const arg of args) {
    const hint = removedFlagHints[arg];

    if (hint) {
      throw new UsageError(hint);
    }
  }
};

type Tokens = ReturnType<typeof tokenize>;

const tokenize = (args: string[]) => {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: cliOptions
    });

    return { values, positionals };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(message);
  }
};

/**
 * Decides which command was asked for, once, and lays the flags out for the schema to check. Help
 * and the version win over everything else on the command line.
 */
const toCandidate = ({ values, positionals }: Tokens, defaultDirectory: string) => {
  if (values.help) {
    return { kind: "help" };
  }

  if (values.version) {
    return { kind: "version" };
  }

  const isInit = positionals[0] === "init";
  const unexpected = isInit ? positionals[1] : positionals[0];

  if (unexpected !== undefined) {
    throw new UsageError(`unexpected argument '${unexpected}'`);
  }

  return {
    kind: isInit ? "init" : "check",
    directory: values.directory ?? defaultDirectory,
    verbose: values.verbose ?? false,
    devDependencies: values["dev-dependencies"]
  };
};

const firstMessage = (error: z.ZodError): string => error.issues[0]?.message ?? error.message;
