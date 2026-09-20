import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Io } from "./io";
import { run } from "./main";

type FakeIo = Io & { stdoutLines: string[]; stderrLines: string[] };

const createFakeIo = (): FakeIo => {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  return {
    stdoutLines,
    stderrLines,
    stdout: line => stdoutLines.push(line),
    stderr: line => stderrLines.push(line)
  };
};

const writeJson = async (path: string, value: unknown) => {
  await writeFile(path, JSON.stringify(value));
};

const createProject = async (
  root: string,
  dependencyLicense: string,
  dependencyKind: "dependencies" | "devDependencies" = "dependencies",
  config: object = {}
) => {
  await writeJson(join(root, "package.json"), {
    name: "test-project",
    version: "1.0.0",
    [dependencyKind]: { "some-dependency": "2.0.0" }
  });
  await writeJson(join(root, ".licenses.json"), { licenses: ["MIT"], packages: [], ...config });

  const dependencyDirectory = join(root, "node_modules", "some-dependency");
  await mkdir(dependencyDirectory, { recursive: true });
  await writeJson(join(dependencyDirectory, "package.json"), {
    name: "some-dependency",
    version: "2.0.0",
    license: dependencyLicense
  });
};

describe("run", () => {
  let directory: string;
  let io: FakeIo;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "license-cop-cli-"));
    io = createFakeIo();
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("should print the help text and exit 0", async () => {
    const exitCode = await run(["--help"], io, directory);

    expect(exitCode).toBe(0);
    expect(io.stdoutLines.join("\n")).toContain("Usage: license-cop");
  });

  it("should print the version and exit 0", async () => {
    const exitCode = await run(["--version"], io, directory);

    expect(exitCode).toBe(0);
    expect(io.stdoutLines).toHaveLength(1);
    expect(io.stdoutLines[0]).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it("should report a usage error on stderr and exit 1", async () => {
    const exitCode = await run(["--nope"], io, directory);

    expect(exitCode).toBe(1);
    expect(io.stdoutLines).toEqual([]);
    expect(io.stderrLines[0]).toStartWith("error:");
  });

  it("should write a config file when initialising", async () => {
    const exitCode = await run(["init"], io, directory);

    expect(exitCode).toBe(0);
    const config = await readFile(join(directory, ".licenses.json"), "utf8");
    expect(JSON.parse(config)).toMatchObject({ licenses: ["MIT", "ISC", "Apache-2.0"] });
    expect(io.stdoutLines).toContain("Done!");
  });

  it("should only log the verbose lines when --verbose is set", async () => {
    await run(["init"], io, directory);
    expect(io.stdoutLines.join("\n")).not.toContain("Writing config file to");

    const verboseIo = createFakeIo();
    await run(["init", "--verbose"], verboseIo, directory);
    expect(verboseIo.stdoutLines[0]).toBe("Verbose logging enabled");
    expect(verboseIo.stdoutLines.join("\n")).toContain("Writing config file to");
  });

  it("should exit 0 when every dependency has an allowed license", async () => {
    await createProject(directory, "MIT");

    const exitCode = await run([], io, directory);

    expect(exitCode).toBe(0);
    expect(io.stdoutLines).toContain("Scanning dependencies of: test-project");
    expect(io.stdoutLines).toContain("\nDone! No issues found");
    expect(io.stdoutLines).toContain("Found 1 packages with allowed licenses");
    expect(io.stderrLines).toEqual([]);
  });

  it("should exit 1 and list the package when a dependency has a forbidden license", async () => {
    await createProject(directory, "GPL-3.0");

    const exitCode = await run([], io, directory);

    expect(exitCode).toBe(1);
    expect(io.stderrLines).toContain("Packages with forbidden licenses:");
    expect(io.stderrLines).toContain("some-dependency@2.0.0 - GPL-3.0");
  });

  it("should ignore a forbidden dev dependency by default", async () => {
    await createProject(directory, "GPL-3.0", "devDependencies");

    const exitCode = await run([], io, directory);

    expect(exitCode).toBe(0);
  });

  it.each(["include", "only"])(
    "should fail on a forbidden dev dependency with --dev-dependencies %s",
    async mode => {
      await createProject(directory, "GPL-3.0", "devDependencies");

      const exitCode = await run(["--dev-dependencies", mode], io, directory);

      expect(exitCode).toBe(1);
      expect(io.stderrLines).toContain("some-dependency@2.0.0 - GPL-3.0");
    }
  );

  it("should use the dev dependency settings of the config file when there is no flag", async () => {
    await createProject(directory, "GPL-3.0", "devDependencies", { includeDevDependencies: true });

    const exitCode = await run([], io, directory);

    expect(exitCode).toBe(1);
  });

  it("should let the flag replace the dev dependency settings of the config file", async () => {
    await createProject(directory, "GPL-3.0", "dependencies", { includeDevDependencies: true });

    const exitCode = await run(["--dev-dependencies", "only"], io, directory);

    expect(exitCode).toBe(0);
  });

  it("should ignore a forbidden production dependency with --dev-dependencies only", async () => {
    await createProject(directory, "GPL-3.0");

    const exitCode = await run(["--dev-dependencies", "only"], io, directory);

    expect(exitCode).toBe(0);
  });

  it("should exit 1 and print the message when the config file is missing", async () => {
    await writeJson(join(directory, "package.json"), { name: "test-project", version: "1.0.0" });

    const exitCode = await run([], io, directory);

    expect(exitCode).toBe(1);
    expect(io.stderrLines).toHaveLength(1);
  });

  it("should exit 1 and print the message when there is no package.json", async () => {
    const exitCode = await run([], io, directory);

    expect(exitCode).toBe(1);
    expect(io.stderrLines).toHaveLength(1);
    expect(io.stderrLines[0]).toContain("Cannot find the file");
    expect(io.stderrLines[0]).not.toContain("    at ");
  });

  it("should exit 1 and print the message when the package.json is invalid", async () => {
    await writeFile(join(directory, "package.json"), "not json");

    const exitCode = await run([], io, directory);

    expect(exitCode).toBe(1);
    expect(io.stderrLines[0]).toContain("Unable to parse package.json");
  });
});
