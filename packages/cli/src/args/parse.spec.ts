import { describe, expect, it } from "bun:test";
import { UsageError } from "../errors";
import { parseCliArgs } from "./parse";

const defaultDirectory = "/default/dir";

describe("parseCliArgs", () => {
  it("should default to a check of the default directory", () => {
    const invocation = parseCliArgs([], defaultDirectory);

    expect(invocation).toEqual({
      kind: "check",
      directory: defaultDirectory,
      verbose: false,
      includeDev: false,
      devOnly: false
    });
  });

  it("should parse every check flag", () => {
    const invocation = parseCliArgs(
      ["--verbose", "-D", "--dev-only", "--directory", "/some/dir"],
      defaultDirectory
    );

    expect(invocation).toEqual({
      kind: "check",
      directory: "/some/dir",
      verbose: true,
      includeDev: true,
      devOnly: true
    });
  });

  it.each([[["-d", "/some/dir"]], [["--directory", "/some/dir"]], [["--directory=/some/dir"]]])(
    "should accept the directory as %p",
    args => {
      const invocation = parseCliArgs(args, defaultDirectory);

      expect(invocation).toMatchObject({ kind: "check", directory: "/some/dir" });
    }
  );

  it.each([[["init"]], [["--init"]], [["init", "--init"]]])(
    "should parse %p as an init invocation",
    args => {
      const invocation = parseCliArgs(args, defaultDirectory);

      expect(invocation).toEqual({ kind: "init", directory: defaultDirectory, verbose: false });
    }
  );

  it("should accept --verbose and --directory on init", () => {
    const invocation = parseCliArgs(["init", "--verbose", "-d", "/some/dir"], defaultDirectory);

    expect(invocation).toEqual({ kind: "init", directory: "/some/dir", verbose: true });
  });

  it.each([[["-v"]], [["--version"]]])("should parse %p as a version invocation", args => {
    expect(parseCliArgs(args, defaultDirectory)).toEqual({ kind: "version" });
  });

  it.each([[["-h"]], [["--help"]]])("should parse %p as a help invocation", args => {
    expect(parseCliArgs(args, defaultDirectory)).toEqual({ kind: "help" });
  });

  it.each([
    ["an unknown flag", ["--nope"]],
    ["an unknown short flag", ["-x"]],
    ["a missing directory value", ["--directory"]],
    ["an unknown command", ["unknown-command"]],
    ["an extra argument after init", ["init", "extra"]],
    ["--include-dev on init", ["init", "-D"]],
    ["--dev-only on init", ["--init", "--dev-only"]]
  ])("should throw a UsageError for %s", (_description, args) => {
    expect(() => parseCliArgs(args, defaultDirectory)).toThrow(UsageError);
  });
});
