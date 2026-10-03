import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { NodeFileSystem } from "./file-system";

const fileSystem = new NodeFileSystem();

describe("directoryExists", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  it("should be true for an existing directory", async () => {
    await mkdir(join(dir.path, "directory"));

    const result = await fileSystem.directoryExists(join(dir.path, "directory"));

    expect(result).toBe(true);
  });

  it("should be false for a missing directory", async () => {
    const result = await fileSystem.directoryExists(join(dir.path, "missing"));

    expect(result).toBe(false);
  });

  it("should be false for a file", async () => {
    await dir.write({ "file.txt": "hello" });

    const result = await fileSystem.directoryExists(join(dir.path, "file.txt"));

    expect(result).toBe(false);
  });
});

describe("fileExists", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  it("should be true for an existing file", async () => {
    await dir.write({ "file.txt": "hello" });

    const result = await fileSystem.fileExists(join(dir.path, "file.txt"));

    expect(result).toBe(true);
  });

  it("should be false for a missing file", async () => {
    const result = await fileSystem.fileExists(join(dir.path, "missing.txt"));

    expect(result).toBe(false);
  });

  it("should be false for a directory", async () => {
    await mkdir(join(dir.path, "directory"));

    const result = await fileSystem.fileExists(join(dir.path, "directory"));

    expect(result).toBe(false);
  });
});

describe("readText", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  it("should read a file as text", async () => {
    await dir.write({ "file.txt": "hello" });

    const result = await fileSystem.readText(join(dir.path, "file.txt"));

    expect(result).toBe("hello");
  });
});

describe("realpath", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  it("should resolve a symlink to its target", async () => {
    await mkdir(join(dir.path, "target"));
    await symlink(join(dir.path, "target"), join(dir.path, "link"));

    const result = await fileSystem.realpath(join(dir.path, "link"));

    expect(result).toBe(await fileSystem.realpath(join(dir.path, "target")));
  });
});
