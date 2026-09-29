import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readBunLock, resolveBunLockPackage, type BunLock } from "./bun-lock";

describe("bun-lock", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  describe("readBunLock", () => {
    it("should throw when there is no bun.lock", async () => {
      const act = readBunLock(dir.path);

      await expect(act).rejects.toThrow("Cannot find the file");
    });

    it("should throw when bun.lock isn't valid JSON5", async () => {
      await dir.write({ "bun.lock": "not json" });

      const act = readBunLock(dir.path);

      await expect(act).rejects.toThrow("Unable to parse bun.lock");
    });

    it("should throw when bun.lock doesn't match the expected shape", async () => {
      await dir.write({ "bun.lock": { lockfileVersion: 2 } });

      const act = readBunLock(dir.path);

      await expect(act).rejects.toThrow("Unable to parse bun.lock");
    });

    it("should parse workspaces and packages, including a trailing-comma JSON5 file", async () => {
      // bun writes trailing commas, which plain JSON.parse rejects but json5Parse accepts.
      const bunLockText = `{
        "lockfileVersion": 2,
        "configVersion": 1,
        "workspaces": {
          "": {
            "name": "root",
            "dependencies": { "leven": "3.1.0" },
          },
        },
        "packages": {
          "leven": ["leven@3.1.0", "", {}, "sha512-x"],
        },
      }`;
      await dir.write({ "bun.lock": bunLockText });

      const lock = await readBunLock(dir.path);

      expect(lock.workspaces[""]).toEqual({ name: "root", dependencies: { leven: "3.1.0" } });
      expect(lock.packages["leven"]).toEqual({ name: "leven", version: "3.1.0", dependencies: {} });
    });

    it("should carry a package's own dependencies through", async () => {
      await dir.write({
        "bun.lock": {
          lockfileVersion: 2,
          configVersion: 1,
          workspaces: { "": { name: "root" } },
          packages: {
            "is-odd": [
              "is-odd@3.0.1",
              "",
              { dependencies: { "is-number": "^6.0.0" } },
              "sha512-x"
            ]
          }
        }
      });

      const lock = await readBunLock(dir.path);

      expect(lock.packages["is-odd"]).toEqual({
        name: "is-odd",
        version: "3.0.1",
        dependencies: { "is-number": "^6.0.0" }
      });
    });

    it("should leave out a workspace member's own entry", async () => {
      await dir.write({
        "bun.lock": {
          lockfileVersion: 2,
          configVersion: 1,
          workspaces: {
            "": { name: "root" },
            "packages/a": { name: "pkg-a" }
          },
          packages: {
            "pkg-a": ["pkg-a@workspace:packages/a"]
          }
        }
      });

      const lock = await readBunLock(dir.path);

      expect(lock.packages["pkg-a"]).toBeUndefined();
    });
  });

  describe("resolveBunLockPackage", () => {
    const lock: BunLock = {
      workspaces: { "": { name: "root" } },
      packages: {
        "is-number": { name: "is-number", version: "4.0.0", dependencies: {} },
        "is-odd": { name: "is-odd", version: "3.0.1", dependencies: { "is-number": "^6.0.0" } },
        "is-odd/is-number": { name: "is-number", version: "6.0.0", dependencies: {} }
      }
    };

    it("should resolve a top-level package by its bare name", () => {
      const result = resolveBunLockPackage(lock, [], "is-odd");

      expect(result).toEqual({ name: "is-odd", version: "3.0.1", dependencies: { "is-number": "^6.0.0" } });
    });

    it("should prefer a path-qualified override over the bare name", () => {
      const result = resolveBunLockPackage(lock, ["is-odd"], "is-number");

      expect(result).toEqual({ name: "is-number", version: "6.0.0", dependencies: {} });
    });

    it("should fall back to the bare name when no override exists for the path", () => {
      const result = resolveBunLockPackage(lock, ["leven"], "is-odd");

      expect(result).toEqual({ name: "is-odd", version: "3.0.1", dependencies: { "is-number": "^6.0.0" } });
    });

    it("should return undefined for a name that isn't in the lockfile", () => {
      const result = resolveBunLockPackage(lock, [], "missing");

      expect(result).toBeUndefined();
    });
  });
});
