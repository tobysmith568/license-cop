import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "./file-exists";

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

    const result = await fileExists(join(dir.path, "file.txt"));

    expect(result).toBe(true);
  });

  it("should be false for a missing file", async () => {
    const result = await fileExists(join(dir.path, "missing.txt"));

    expect(result).toBe(false);
  });

  it("should be false for a directory", async () => {
    await mkdir(join(dir.path, "directory"));

    const result = await fileExists(join(dir.path, "directory"));

    expect(result).toBe(false);
  });
});
