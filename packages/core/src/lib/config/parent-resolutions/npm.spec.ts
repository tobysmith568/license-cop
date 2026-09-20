import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { ConfigError } from "../config-error";
import { nodeModuleExists, npmResolution } from "./npm";

describe("npm parent resolution", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  describe("npmResolution", () => {
    it("should load the config from the installed package", async () => {
      await dir.write({ "node_modules/some-config/.licenses.json": { licenses: ["MIT"] } });

      const result = await npmResolution("some-config", dir.path);

      expect(result).toEqual({ licenses: ["MIT"] });
    });

    it("should load the config from a scoped package", async () => {
      await dir.write({ "node_modules/@scope/config/.licenses.json": { licenses: ["ISC"] } });

      const result = await npmResolution("@scope/config", dir.path);

      expect(result).toEqual({ licenses: ["ISC"] });
    });

    it("should report what it's resolving", async () => {
      await dir.write({ "node_modules/some-config/.licenses.json": {} });
      const messages: string[] = [];

      await npmResolution("some-config", dir.path, message => messages.push(message));

      expect(messages).toEqual(["Resolving npm package: some-config"]);
    });

    it("should throw a ConfigError when the package isn't installed", async () => {
      const act = npmResolution("missing", dir.path);

      await expect(act).rejects.toThrow(ConfigError);
    });
  });

  describe("nodeModuleExists", () => {
    it("should be true for an installed package", async () => {
      await dir.write({ "node_modules/some-config/package.json": {} });

      const result = await nodeModuleExists("some-config", dir.path);

      expect(result).toBe(true);
    });

    it("should be false for a package that isn't installed", async () => {
      const result = await nodeModuleExists("missing", dir.path);

      expect(result).toBe(false);
    });

    it("should be false when the path is a file", async () => {
      await dir.write({ "node_modules/some-file": "" });

      const result = await nodeModuleExists("some-file", dir.path);

      expect(result).toBe(false);
    });
  });
});
