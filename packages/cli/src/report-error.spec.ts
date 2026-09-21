import { ConfigError, LicenseCopError } from "@license-cop/core";
import { describe, expect, it } from "bun:test";
import { UsageError } from "./errors";
import type { Io } from "./io";
import { reportError } from "./report-error";

const createIo = () => {
  const stderr: string[] = [];
  const io: Io = { stdout: () => {}, stderr: line => stderr.push(line) };

  return { io, stderr };
};

const fileSystemError = (code: string, path: string) =>
  Object.assign(new Error(`${code}: something, open '${path}'`), { code, path });

describe("reportError", () => {
  it("should report a usage error with a hint to the help", () => {
    const { io, stderr } = createIo();

    const exitCode = reportError(new UsageError("unknown option"), io, false);

    expect(exitCode).toBe(1);
    expect(stderr).toEqual(["error: unknown option", "Run 'license-cop --help' for usage"]);
  });

  it("should report a LicenseCopError by its message alone", () => {
    const { io, stderr } = createIo();

    const exitCode = reportError(new ConfigError("bad"), io, false);

    expect(exitCode).toBe(1);
    expect(stderr).toEqual(["Config error: bad"]);
  });

  it("should treat a subclass it has never heard of the same way", () => {
    class BrandNewError extends LicenseCopError {}
    const { io, stderr } = createIo();

    reportError(new BrandNewError("nope"), io, false);

    expect(stderr).toEqual(["nope"]);
  });

  describe("an unexpected error", () => {
    it("should give one line and how to see more, without a stack", () => {
      const { io, stderr } = createIo();

      const exitCode = reportError(new Error("something broke"), io, false);

      expect(exitCode).toBe(1);
      expect(stderr).toEqual([
        "error: something broke",
        "Run again with --verbose to see the full stack trace"
      ]);
    });

    it("should include the stack when verbose", () => {
      const { io, stderr } = createIo();
      const error = new Error("something broke");

      reportError(error, io, true);

      expect(stderr[0]).toBe("error: something broke");
      expect(stderr[1]).toBe(error.stack);
      expect(stderr.join("\n")).not.toContain("--verbose");
    });

    it("should report something that isn't an Error", () => {
      const { io, stderr } = createIo();

      const exitCode = reportError("just a string", io, true);

      expect(exitCode).toBe(1);
      expect(stderr).toEqual(["error: just a string"]);
    });
  });

  describe("a file system error", () => {
    it.each([
      ["ENOENT", "no such file or directory"],
      ["EACCES", "permission denied"],
      ["EPERM", "operation not permitted"],
      ["EISDIR", "is a directory"],
      ["EROFS", "read-only file system"]
    ])("should describe %s as a sentence naming the path", (code, sentence) => {
      const { io, stderr } = createIo();

      reportError(fileSystemError(code, "/some/path"), io, false);

      expect(stderr[0]).toBe(`error: ${sentence}: /some/path`);
    });

    it("should fall back to the message for a code it doesn't describe", () => {
      const { io, stderr } = createIo();
      const error = fileSystemError("EMFILE", "/some/path");

      reportError(error, io, false);

      expect(stderr[0]).toBe(`error: ${error.message}`);
    });
  });
});
