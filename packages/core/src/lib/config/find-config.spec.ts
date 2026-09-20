import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { ConfigError } from "./config-error";
import { findConfig } from "./find-config";

describe("findConfig", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  const config = { licenses: ["MIT"] };

  it.each([
    [".licenses.json"],
    [".licenses.jsonc"],
    [".licenses.json5"],
    [".licenses"],
    [".licenses.yaml"],
    [".licenses.yml"],
    [".licenses.cjs"],
    [".licences.json"],
    [".licensesrc.json"],
    [".licencesrc.json"],
    [".config/licenses.json"],
    [".config/licenses.yaml"],
    ["licenses.config.cjs"]
  ])("should find a config in %s", async fileName => {
    const contents = fileName.endsWith("cjs")
      ? `module.exports = ${JSON.stringify(config)};`
      : fileName.endsWith("ya") || fileName.endsWith("yaml") || fileName.endsWith("yml")
        ? "licenses:\n  - MIT\n"
        : JSON.stringify(config);
    await dir.write({ [fileName]: contents });

    const result = await findConfig(dir.path);

    expect(result).toEqual(config);
  });

  it("should parse JSON5 syntax in .json files", async () => {
    await dir.write({
      ".licenses.json": `{
        // Comments are allowed
        licenses: ['MIT'],
      }`
    });

    const result = await findConfig(dir.path);

    expect(result).toEqual(config);
  });

  it("should find a config in the licensecop property of the package.json", async () => {
    await dir.write({ "package.json": { name: "test", version: "1.0.0", licensecop: config } });

    const result = await findConfig(dir.path);

    expect(result).toEqual(config);
  });

  it("should ignore a package.json without a licensecop property", async () => {
    await dir.write({
      "package.json": { name: "test", version: "1.0.0" },
      ".licenses.json": config
    });

    const result = await findConfig(dir.path);

    expect(result).toEqual(config);
  });

  it("should throw a ConfigError when there is no config", async () => {
    await dir.write({ "package.json": { name: "test", version: "1.0.0" } });

    const act = findConfig(dir.path);

    await expect(act).rejects.toThrow(ConfigError);
    await expect(act).rejects.toThrow("No config file found");
  });

  it("should throw a ConfigError when the config can't be parsed", async () => {
    await dir.write({ ".licenses.json": "{ not valid" });

    const act = findConfig(dir.path);

    await expect(act).rejects.toThrow(ConfigError);
  });

  it("should not search above the given directory", async () => {
    await dir.write({ ".licenses.json": config });

    const act = findConfig(`${dir.path}/child`);

    await expect(act).rejects.toThrow(ConfigError);
  });
});
