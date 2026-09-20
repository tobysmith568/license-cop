import { parseArgs, type ParseArgsConfig } from "node:util";
import { z } from "zod";
import { UsageError } from "../errors";
import { cliInvocationSchema, type CliInvocation, type DevDependenciesMode } from "./schema";

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

  const { values, positionals } = tokenize(args);

  if (values.help) {
    return { kind: "help" };
  }

  if (values.version) {
    return { kind: "version" };
  }

  const isInit = positionals[0] === "init";
  const unexpectedPositionals = isInit ? positionals.slice(1) : positionals;

  if (unexpectedPositionals.length > 0) {
    throw new UsageError(`unexpected argument '${unexpectedPositionals[0]}'`);
  }

  const directory = values.directory ?? defaultDirectory;
  const verbose = values.verbose ?? false;

  if (isInit) {
    if (values["dev-dependencies"] !== undefined) {
      throw new UsageError("'init' does not accept --dev-dependencies");
    }

    return validate({ kind: "init", directory, verbose });
  }

  return validate({
    kind: "check",
    directory,
    verbose,
    devDependencies: parseDevDependencies(values["dev-dependencies"])
  });
};

const throwIfRemovedFlag = (args: string[]) => {
  for (const arg of args) {
    const hint = removedFlagHints[arg];

    if (hint) {
      throw new UsageError(hint);
    }
  }
};

const parseDevDependencies = (value: string | undefined): DevDependenciesMode | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === "include" || value === "only") {
    return value;
  }

  throw new UsageError(`--dev-dependencies must be 'include' or 'only', but got '${value}'`);
};

const tokenize = (args: string[]) => {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: cliOptions
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(message);
  }
};

const validate = (candidate: unknown): CliInvocation => {
  const result = cliInvocationSchema.safeParse(candidate);

  if (!result.success) {
    throw new UsageError(z.prettifyError(result.error));
  }

  return result.data;
};
