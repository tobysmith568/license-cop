import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createTempDir, type TempDir } from "../test-utils/temp-dir";
import { ConfigError } from "./config-error";
import { loadConfig } from "./load-config";

describe("loadConfig", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  it("should load and parse a config with no parent", async () => {
    await dir.write({ ".licenses.json": { licenses: ["MIT"], packages: ["react"] } });

    const result = await loadConfig(dir.path);

    expect(result).toEqual({
      extends: undefined,
      licenses: ["MIT"],
      packages: ["react"],
      includeDevDependencies: false,
      devDependenciesOnly: false
    });
  });

  it("should throw a ConfigError when there is no config", async () => {
    const act = loadConfig(dir.path);

    await expect(act).rejects.toThrow(ConfigError);
  });

  it("should throw a ConfigError when the config is invalid", async () => {
    await dir.write({ ".licenses.json": { licenses: "MIT" } });

    const act = loadConfig(dir.path);

    await expect(act).rejects.toThrow(ConfigError);
  });

  describe("extends", () => {
    it("should combine the licenses and packages of the parent and child", async () => {
      await dir.write({
        ".licenses.json": { extends: "npm:parent", licenses: ["MIT"], packages: ["a"] },
        "node_modules/parent/.licenses.json": { licenses: ["ISC"], packages: ["b"] }
      });

      const result = await loadConfig(dir.path);

      expect(result.licenses.sort()).toEqual(["ISC", "MIT"]);
      expect(result.packages.sort()).toEqual(["a", "b"]);
    });

    it("should resolve an unprefixed name that is an installed module", async () => {
      await dir.write({
        ".licenses.json": { extends: "parent", licenses: ["MIT"] },
        "node_modules/parent/.licenses.json": { licenses: ["ISC"] }
      });

      const result = await loadConfig(dir.path);

      expect(result.licenses.sort()).toEqual(["ISC", "MIT"]);
    });

    it("should inherit values from the parent that the child doesn't set", async () => {
      await dir.write({
        ".licenses.json": { extends: "npm:parent" },
        "node_modules/parent/.licenses.json": {
          includeDevDependencies: true,
          devDependenciesOnly: true
        }
      });

      const result = await loadConfig(dir.path);

      expect(result.includeDevDependencies).toBe(true);
      expect(result.devDependenciesOnly).toBe(true);
    });

    it("should let the child override values of the parent", async () => {
      await dir.write({
        ".licenses.json": { extends: "npm:parent", includeDevDependencies: false },
        "node_modules/parent/.licenses.json": { includeDevDependencies: true }
      });

      const result = await loadConfig(dir.path);

      expect(result.includeDevDependencies).toBe(false);
    });

    it("should follow a chain of parents", async () => {
      await dir.write({
        ".licenses.json": { extends: "npm:parent", licenses: ["MIT"] },
        "node_modules/parent/.licenses.json": { extends: "npm:grandparent", licenses: ["ISC"] },
        "node_modules/grandparent/.licenses.json": { licenses: ["Apache-2.0"] }
      });

      const result = await loadConfig(dir.path);

      expect(result.licenses.sort()).toEqual(["Apache-2.0", "ISC", "MIT"]);
      expect(result.extends).toBeUndefined();
    });

    it("should report each parent it extends", async () => {
      await dir.write({
        ".licenses.json": { extends: "npm:parent" },
        "node_modules/parent/.licenses.json": {}
      });
      const messages: string[] = [];

      await loadConfig(dir.path, message => messages.push(message));

      expect(messages).toContain("Extending config with npm:parent");
    });

    it("should throw a ConfigError when a parent can't be found", async () => {
      await dir.write({ ".licenses.json": { extends: "npm:missing" } });

      const act = loadConfig(dir.path);

      await expect(act).rejects.toThrow(ConfigError);
    });

    it("should throw a ConfigError for an unprefixed parent that isn't an installed module", async () => {
      await dir.write({ ".licenses.json": { extends: "not-installed" } });

      const act = loadConfig(dir.path);

      await expect(act).rejects.toThrow(ConfigError);
      await expect(act).rejects.toThrow("Invalid parent config location: not-installed");
    });

    it("should throw a ConfigError when the parent is invalid", async () => {
      await dir.write({
        ".licenses.json": { extends: "npm:parent" },
        "node_modules/parent/.licenses.json": { licenses: "MIT" }
      });

      const act = loadConfig(dir.path);

      await expect(act).rejects.toThrow(ConfigError);
    });

    it("should throw a ConfigError rather than looping forever when parents are circular", async () => {
      await dir.write({
        ".licenses.json": { extends: "npm:a" },
        "node_modules/a/.licenses.json": { extends: "npm:b" },
        "node_modules/b/.licenses.json": { extends: "npm:a" }
      });

      const act = loadConfig(dir.path);

      await expect(act).rejects.toThrow(ConfigError);
      await expect(act).rejects.toThrow("Circular");
    });
  });
});
