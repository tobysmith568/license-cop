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
      verbose: false
    });
    expect(invocation).toMatchObject({ devDependencies: undefined });
  });

  it("should parse every check flag", () => {
    const invocation = parseCliArgs(
      ["--verbose", "--dev-dependencies", "include", "--directory", "/some/dir"],
      defaultDirectory
    );

    expect(invocation).toEqual({
      kind: "check",
      directory: "/some/dir",
      verbose: true,
      devDependencies: "include"
    });
  });

  it.each(["include", "only"])("should accept --dev-dependencies %s", mode => {
    const invocation = parseCliArgs(["--dev-dependencies", mode], defaultDirectory);

    expect(invocation).toMatchObject({ kind: "check", devDependencies: mode });
  });

  it.each([[["-d", "/some/dir"]], [["--directory", "/some/dir"]], [["--directory=/some/dir"]]])(
    "should accept the directory as %p",
    args => {
      const invocation = parseCliArgs(args, defaultDirectory);

      expect(invocation).toMatchObject({ kind: "check", directory: "/some/dir" });
    }
  );

  it("should parse init as an init invocation", () => {
    const invocation = parseCliArgs(["init"], defaultDirectory);

    expect(invocation).toEqual({ kind: "init", directory: defaultDirectory, verbose: false });
  });

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
    [["--init"], "license-cop init"],
    [["-D"], "--dev-dependencies include"],
    [["--include-dev"], "--dev-dependencies include"],
    [["--dev-only"], "--dev-dependencies only"]
  ])("should point users of the removed flag %p at its replacement", (args, replacement) => {
    expect(() => parseCliArgs(args, defaultDirectory)).toThrow(replacement);
  });

  it.each([
    ["an unknown flag", ["--nope"]],
    ["an unknown short flag", ["-x"]],
    ["a missing directory value", ["--directory"]],
    ["an unknown command", ["unknown-command"]],
    ["an extra argument after init", ["init", "extra"]],
    ["the removed --init flag", ["--init"]],
    ["the removed --include-dev flag", ["--include-dev"]],
    ["the removed -D flag", ["-D"]],
    ["the removed --dev-only flag", ["--dev-only"]],
    ["an invalid --dev-dependencies value", ["--dev-dependencies", "sometimes"]],
    ["a missing --dev-dependencies value", ["--dev-dependencies"]],
    ["--dev-dependencies on init", ["init", "--dev-dependencies", "only"]]
  ])("should throw a UsageError for %s", (_description, args) => {
    expect(() => parseCliArgs(args, defaultDirectory)).toThrow(UsageError);
  });
});
