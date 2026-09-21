import { LicenseCopError } from "@license-cop/core";
import { UsageError } from "./errors";
import type { Io } from "./io";

/**
 * Turns anything a command threw into a message and an exit code, so that `run` never throws. What
 * the user did wrong reads as a sentence; only what nobody expected shows a stack, and only when
 * asked to, since a stack trace is no help to someone who just mistyped a directory.
 */
export const reportError = (error: unknown, io: Io, verbose: boolean): number => {
  if (error instanceof UsageError) {
    io.stderr(`error: ${error.message}`);
    io.stderr("Run 'license-cop --help' for usage");
    return 1;
  }

  if (error instanceof LicenseCopError) {
    io.stderr(error.message);
    return 1;
  }

  io.stderr(`error: ${describeUnexpectedError(error)}`);

  if (!verbose) {
    io.stderr("Run again with --verbose to see the full stack trace");
    return 1;
  }

  if (error instanceof Error && error.stack) {
    io.stderr(error.stack);
  }

  return 1;
};

// The failures of reading or writing files that are down to the environment rather than a bug
const fileSystemProblems: Record<string, string> = {
  ENOENT: "no such file or directory",
  EACCES: "permission denied",
  EPERM: "operation not permitted",
  EISDIR: "is a directory",
  EROFS: "read-only file system"
};

const describeUnexpectedError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const { code, path } = error as Error & { code?: unknown; path?: unknown };
  const problem = typeof code === "string" ? fileSystemProblems[code] : undefined;

  if (problem && typeof path === "string") {
    return `${problem}: ${path}`;
  }

  return error.message;
};
