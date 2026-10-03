import { beforeEach, describe, expect, it } from "bun:test";
import { NullLogger } from "../logging/logger";
import { createMemoryDir, type MemoryDir } from "../utils/in-memory-file-system";
import { FileBunLockReader } from "./bun-lock-reader";

describe("FileBunLockReader", () => {
  let dir: MemoryDir;
  let reader: FileBunLockReader;

  beforeEach(() => {
    dir = createMemoryDir();
    reader = new FileBunLockReader(dir.fileSystem, new NullLogger());
  });

  it("should throw when there is no bun.lock", async () => {
    const act = reader.read(dir.path);

    await expect(act).rejects.toThrow("Cannot find the file");
  });

  it("should throw when bun.lock isn't valid JSON5", async () => {
    dir.write({ "bun.lock": "not json" });

    const act = reader.read(dir.path);

    await expect(act).rejects.toThrow("Unable to parse bun.lock");
  });

  it("should throw when bun.lock doesn't match the expected shape", async () => {
    dir.write({ "bun.lock": { lockfileVersion: 2 } });

    const act = reader.read(dir.path);

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
    dir.write({ "bun.lock": bunLockText });

    const lock = await reader.read(dir.path);

    expect(lock.workspaceAt("")).toEqual({ name: "root", dependencies: { leven: "3.1.0" } });
  });

  it("should parse every workspace member, keyed by its path", async () => {
    dir.write({
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

    const lock = await reader.read(dir.path);

    expect(
      lock
        .members()
        .map(([path]) => path)
        .sort()
    ).toEqual(["", "packages/a", "packages/b"]);
    expect(lock.workspaceAt("packages/a")).toEqual({
      name: "pkg-a",
      dependencies: { leven: "3.1.0" }
    });
    expect(lock.workspaceAt("packages/b")).toEqual({
      name: "pkg-b",
      devDependencies: { "is-odd": "3.0.1" }
    });
  });

  it("should find a workspace's path by its name", async () => {
    dir.write({
      "bun.lock": {
        lockfileVersion: 2,
        configVersion: 1,
        workspaces: { "": { name: "root" }, "packages/a": { name: "pkg-a" }, "packages/c": {} }
      }
    });

    const lock = await reader.read(dir.path);

    expect(lock.pathOfWorkspaceNamed("pkg-a")).toBe("packages/a");
    expect(lock.pathOfWorkspaceNamed("missing")).toBeUndefined();
  });
});
