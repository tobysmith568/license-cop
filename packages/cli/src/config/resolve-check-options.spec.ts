import { PackageJsonError } from "@license-cop/core";
import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { ConfigError } from "./config-error";
import { resolveCheckOptions } from "./resolve-check-options";

const noop = () => {};
const noFlag = { devDependencies: undefined, onVerbose: noop };

describe("resolveCheckOptions", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  const writeProject = (config: object = {}) =>
    dir.write({
      "package.json": { name: "my-project", version: "1.0.0" },
      ".licenses.json": { licenses: ["MIT"], packages: ["left-pad"], ...config }
    });

  it("should return the project's name", async () => {
    await writeProject();

    const { productName } = await resolveCheckOptions(dir.path, noFlag);

    expect(productName).toBe("my-project");
  });

  it("should turn the config into options for checkLicenses", async () => {
    await writeProject();

    const { options } = await resolveCheckOptions(dir.path, noFlag);

    expect(options).toMatchObject({
      allowedLicenses: ["MIT"],
      allowedPackages: ["left-pad"],
      workingDirectory: dir.path,
      includeDevDependencies: false,
      devDependenciesOnly: false
    });
  });

  it("should use the dev dependency settings of the config when there's no flag", async () => {
    await writeProject({ devDependenciesOnly: true });

    const { options } = await resolveCheckOptions(dir.path, noFlag);

    expect(options.devDependenciesOnly).toBe(true);
  });

  it("should let the flag replace the dev dependency settings of the config", async () => {
    await writeProject({ devDependenciesOnly: true });

    const { options } = await resolveCheckOptions(dir.path, {
      ...noFlag,
      devDependencies: "include"
    });

    expect(options).toMatchObject({ includeDevDependencies: true, devDependenciesOnly: false });
  });

  it("should apply a config's parent before the flag", async () => {
    await dir.write({
      "package.json": { name: "my-project", version: "1.0.0" },
      "node_modules/parent/.licenses.json": { licenses: ["ISC"] },
      ".licenses.json": { extends: "npm:parent", licenses: ["MIT"] }
    });

    const { options } = await resolveCheckOptions(dir.path, noFlag);

    expect(options.allowedLicenses.sort()).toEqual(["ISC", "MIT"]);
  });

  it("should report what it's doing through onVerbose", async () => {
    await dir.write({
      "package.json": { name: "my-project", version: "1.0.0" },
      "node_modules/parent/.licenses.json": { licenses: ["ISC"] },
      ".licenses.json": { extends: "npm:parent" }
    });
    const messages: string[] = [];

    await resolveCheckOptions(dir.path, {
      ...noFlag,
      onVerbose: message => messages.push(message)
    });

    expect(messages).toContain("Extending config with npm:parent");
  });

  it("should pass onVerbose on to the options", async () => {
    await writeProject();
    const onVerbose = () => {};

    const { options } = await resolveCheckOptions(dir.path, { ...noFlag, onVerbose });

    expect(options.onVerbose).toBe(onVerbose);
  });

  it("should throw a ConfigError when there is no config", async () => {
    await dir.write({ "package.json": { name: "my-project", version: "1.0.0" } });

    const act = resolveCheckOptions(dir.path, noFlag);

    await expect(act).rejects.toThrow(ConfigError);
  });

  it("should throw a PackageJsonError when there is no package.json", async () => {
    const act = resolveCheckOptions(dir.path, noFlag);

    await expect(act).rejects.toThrow(PackageJsonError);
  });
});
