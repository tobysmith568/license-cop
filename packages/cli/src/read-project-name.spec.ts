import { PackageJsonError } from "@license-cop/core";
import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readProjectName } from "./read-project-name";

describe("readProjectName", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  const noop = () => {};

  it("should return the name of the package.json", async () => {
    await dir.write({ "package.json": { name: "my-project", version: "1.0.0" } });

    const result = await readProjectName(`${dir.path}/package.json`, noop);

    expect(result).toBe("my-project");
  });

  it("should not need a version", async () => {
    await dir.write({ "package.json": { name: "my-project" } });

    const result = await readProjectName(`${dir.path}/package.json`, noop);

    expect(result).toBe("my-project");
  });

  it("should report a missing file through onVerbose", async () => {
    const messages: string[] = [];

    const act = readProjectName(`${dir.path}/package.json`, message => messages.push(message));

    await expect(act).rejects.toThrow(PackageJsonError);
    expect(messages).toEqual([`Cannot find the package.json: '${dir.path}/package.json'`]);
  });

  it("should throw a PackageJsonError when the file isn't valid JSON", async () => {
    await dir.write({ "package.json": "{ nope" });

    const act = readProjectName(`${dir.path}/package.json`, noop);

    await expect(act).rejects.toThrow(PackageJsonError);
  });

  it("should throw a PackageJsonError when there's no name", async () => {
    await dir.write({ "package.json": { version: "1.0.0" } });

    const act = readProjectName(`${dir.path}/package.json`, noop);

    await expect(act).rejects.toThrow(PackageJsonError);
  });
});
