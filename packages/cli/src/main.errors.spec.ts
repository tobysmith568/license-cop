import { LicenseCopError } from "@license-cop/core";
import { describe, expect, it, mock } from "bun:test";
import type { Io } from "./io";

// An error type that `main.ts` has never heard of: it must be reported like the built-in ones
class BrandNewError extends LicenseCopError {}

const runCheck = mock();

void mock.module("./commands/check", () => ({ runCheck }));

const { run } = await import("./main");

const createIo = () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: Io = { stdout: line => stdout.push(line), stderr: line => stderr.push(line) };

  return { io, stdout, stderr };
};

describe("run", () => {
  it("should report any LicenseCopError by its message and exit with 1", async () => {
    runCheck.mockRejectedValue(new BrandNewError("this project can't be checked"));
    const { io, stderr } = createIo();

    const exitCode = await run([], io, "/project");

    expect(exitCode).toBe(1);
    expect(stderr).toEqual(["this project can't be checked"]);
  });
});
