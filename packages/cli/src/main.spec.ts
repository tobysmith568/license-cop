import { createTempDir, writeJson, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile } from "node:fs/promises";
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
  let tempDir: TempDir;
  let directory: string;
  let io: FakeIo;

  beforeEach(async () => {
    tempDir = await createTempDir({ prefix: "license-cop-cli-" });
    directory = tempDir.path;
    io = createFakeIo();
  });

  afterEach(async () => {
    await tempDir.remove();
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

  it.each([
    [".licenses.json", "{}"],
    [".licencesrc.yaml", "licenses: []"],
    [".config/licenses.json5", "{}"],
    ["licenses.config.cjs", "module.exports = {}"],
    ["package.json", JSON.stringify({ name: "test", licensecop: { licenses: ["MIT"] } })]
  ])("should refuse to initialise when there is already a config in %s", async (file, contents) => {
    await tempDir.write({ [file]: contents });

    const exitCode = await run(["init"], io, directory);

    expect(exitCode).toBe(1);
    expect(io.stderrLines).toHaveLength(1);
    expect(io.stderrLines[0]).toContain(join(directory, file));
    expect(io.stdoutLines).not.toContain("Done!");
  });

  it("should refuse to initialise when the existing config can't be loaded, without writing", async () => {
    await tempDir.write({ ".licenses.json": "{ not valid" });

    const exitCode = await run(["init"], io, directory);

    expect(exitCode).toBe(1);
    expect(io.stderrLines).toHaveLength(1);
    const config = await readFile(join(directory, ".licenses.json"), "utf8");
    expect(config).toBe("{ not valid");
  });

  it("should not count an empty file as a config, since license-cop wouldn't use it", async () => {
    await tempDir.write({ ".licenses.json": "" });

    const exitCode = await run(["init"], io, directory);

    expect(exitCode).toBe(0);
  });

  it("should leave an existing config untouched when refusing to initialise", async () => {
    await tempDir.write({ ".licenses.json": "my own config" });

    await run(["init"], io, directory);

    const config = await readFile(join(directory, ".licenses.json"), "utf8");
    expect(config).toBe("my own config");
  });

  it("should initialise next to a package.json that has no config", async () => {
    await tempDir.write({ "package.json": { name: "test" } });

    const exitCode = await run(["init"], io, directory);

    expect(exitCode).toBe(0);
  });

  it("should only log the verbose lines when --verbose is set", async () => {
    await run(["init"], io, directory);
    expect(io.stdoutLines.join("\n")).not.toContain("Writing config file to");

    // The first run made a config, so init would refuse to run again in the same directory
    const otherDirectory = join(directory, "other");
    await mkdir(otherDirectory);

    const verboseIo = createFakeIo();
    await run(["init", "--verbose"], verboseIo, otherDirectory);
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
    await tempDir.write({ "package.json": "not json" });

    const exitCode = await run([], io, directory);

    expect(exitCode).toBe(1);
    expect(io.stderrLines[0]).toContain("Unable to parse package.json");
  });

  it("should exit 1 and explain when the project uses Yarn Plug'n'Play", async () => {
    await createProject(directory, "MIT");
    await tempDir.write({ "yarn.lock": "", ".pnp.cjs": "" });

    const exitCode = await run([], io, directory);

    expect(exitCode).toBe(1);
    expect(io.stderrLines).toHaveLength(1);
    expect(io.stderrLines[0]).toContain("Plug'n'Play");
    expect(io.stderrLines[0]).toContain("nodeLinker: node-modules");
  });

  it("should exit 1 and say to install when the dependencies aren't installed", async () => {
    await tempDir.write({
      "package.json": { name: "test-project", version: "1.0.0", dependencies: { a: "1.0.0" } },
      ".licenses.json": { licenses: ["MIT"], packages: [] }
    });

    const exitCode = await run([], io, directory);

    expect(exitCode).toBe(1);
    expect(io.stderrLines).toHaveLength(1);
    expect(io.stderrLines[0]).toContain("aren't installed");
    expect(io.stderrLines[0]).toContain("npm install");
  });
});
