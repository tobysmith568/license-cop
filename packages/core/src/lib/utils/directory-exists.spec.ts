import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { directoryExists } from "./directory-exists";

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

    const result = await directoryExists(join(dir.path, "directory"));

    expect(result).toBe(true);
  });

  it("should be false for a missing directory", async () => {
    const result = await directoryExists(join(dir.path, "missing"));

    expect(result).toBe(false);
  });

  it("should be false for a file", async () => {
    await dir.write({ "file.txt": "hello" });

    const result = await directoryExists(join(dir.path, "file.txt"));

    expect(result).toBe(false);
  });
});
