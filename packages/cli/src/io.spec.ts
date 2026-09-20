import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { createVerboseLogger, defaultIo, type Io } from "./io";

const createFakeIo = () => {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const io: Io = {
    stdout: line => stdoutLines.push(line),
    stderr: line => stderrLines.push(line)
  };

  return { io, stdoutLines, stderrLines };
};

describe("defaultIo", () => {
  const spies: ReturnType<typeof spyOn>[] = [];

  afterEach(() => {
    for (const spy of spies.splice(0)) {
      spy.mockRestore();
    }
  });

  it("should write stdout lines with console.log", () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    spies.push(log);

    defaultIo.stdout("hello");

    expect(log).toHaveBeenCalledWith("hello");
  });

  it("should write stderr lines with console.error", () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    spies.push(error);

    defaultIo.stderr("oh no");

    expect(error).toHaveBeenCalledWith("oh no");
  });
});

describe("createVerboseLogger", () => {
  it("should write nothing when disabled", () => {
    const { io, stdoutLines, stderrLines } = createFakeIo();

    const verbose = createVerboseLogger(io, false);
    verbose("a message");

    expect(stdoutLines).toEqual([]);
    expect(stderrLines).toEqual([]);
  });

  it("should announce itself when enabled", () => {
    const { io, stdoutLines } = createFakeIo();

    createVerboseLogger(io, true);

    expect(stdoutLines).toEqual(["Verbose logging enabled"]);
  });

  it("should write messages to stdout when enabled", () => {
    const { io, stdoutLines, stderrLines } = createFakeIo();

    const verbose = createVerboseLogger(io, true);
    verbose("a message");

    expect(stdoutLines).toEqual(["Verbose logging enabled", "a message"]);
    expect(stderrLines).toEqual([]);
  });
});
