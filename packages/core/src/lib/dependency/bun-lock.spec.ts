import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readBunLock } from "./bun-lock";

describe("readBunLock", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

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

  it("should parse workspaces, including a trailing-comma JSON5 file", async () => {
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
      "packages": {},
    }`;
    await dir.write({ "bun.lock": bunLockText });

    const lock = await readBunLock(dir.path);

    expect(lock.workspaces[""]).toEqual({ name: "root", dependencies: { leven: "3.1.0" } });
  });

  it("should parse every workspace member, keyed by its path", async () => {
    await dir.write({
      "bun.lock": {
        lockfileVersion: 2,
        configVersion: 1,
        workspaces: {
          "": { name: "root" },
          "packages/a": { name: "pkg-a", dependencies: { leven: "3.1.0" } },
          "packages/b": { name: "pkg-b", devDependencies: { "is-odd": "3.0.1" } }
        }
      }
    });

    const lock = await readBunLock(dir.path);

    expect(Object.keys(lock.workspaces).sort()).toEqual(["", "packages/a", "packages/b"]);
    expect(lock.workspaces["packages/a"]).toEqual({
      name: "pkg-a",
      dependencies: { leven: "3.1.0" }
    });
    expect(lock.workspaces["packages/b"]).toEqual({
      name: "pkg-b",
      devDependencies: { "is-odd": "3.0.1" }
    });
  });
});
