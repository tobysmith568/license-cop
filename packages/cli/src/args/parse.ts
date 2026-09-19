import { parseArgs } from "node:util";
import { UsageError } from "../errors";
import { cliInvocationSchema, type CliInvocation } from "./schema";

export const parseCliArgs = (args: string[], defaultDirectory: string): CliInvocation => {
  const { values, positionals } = tokenize(args);

  if (values.help) {
    return { kind: "help" };
  }

  if (values.version) {
    return { kind: "version" };
  }

  const isInit = values.init || positionals[0] === "init";
  const unexpectedPositionals = isInit ? positionals.slice(1) : positionals;

  if (unexpectedPositionals.length > 0) {
    throw new UsageError(`unexpected argument '${unexpectedPositionals[0]}'`);
  }

  const directory = values.directory ?? defaultDirectory;
  const verbose = values.verbose ?? false;

  if (isInit) {
    if (values["include-dev"] || values["dev-only"]) {
      throw new UsageError("'init' does not accept --include-dev or --dev-only");
    }

    return validate({ kind: "init", directory, verbose });
  }

  return validate({
    kind: "check",
    directory,
    verbose,
    includeDev: values["include-dev"] ?? false,
    devOnly: values["dev-only"] ?? false
  });
};

const tokenize = (args: string[]) => {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: {
        directory: { type: "string", short: "d" },
        verbose: { type: "boolean" },
        "include-dev": { type: "boolean", short: "D" },
        "dev-only": { type: "boolean" },
        init: { type: "boolean" },
        version: { type: "boolean", short: "v" },
        help: { type: "boolean", short: "h" }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(message);
  }
};

const validate = (candidate: unknown): CliInvocation => {
  const result = cliInvocationSchema.safeParse(candidate);

  if (!result.success) {
    throw new UsageError(result.error.message);
  }

  return result.data;
};
