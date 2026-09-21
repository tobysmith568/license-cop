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

  it("should report an unexpected error as one line, without the stack", async () => {
    runCheck.mockRejectedValue(new Error("something broke"));
    const { io, stderr } = createIo();

    const exitCode = await run([], io, "/project");

    expect(exitCode).toBe(1);
    expect(stderr[0]).toBe("error: something broke");
    expect(stderr.join("\n")).not.toContain("    at ");
  });

  it("should include the stack for an unexpected error when --verbose is set", async () => {
    runCheck.mockRejectedValue(new Error("something broke"));
    const { io, stderr } = createIo();

    const exitCode = await run(["--verbose"], io, "/project");

    expect(exitCode).toBe(1);
    expect(stderr.join("\n")).toContain("    at ");
  });
});
