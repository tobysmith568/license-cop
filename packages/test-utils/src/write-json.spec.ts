import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createTempDir, type TempDir } from "./temp-dir";
import { writeJson } from "./write-json";

describe("writeJson", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  it("should write the contents as JSON, creating missing parent directories", async () => {
    const path = join(dir.path, "a/b/c.json");

    await writeJson(path, { value: [1, 2] });

    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ value: [1, 2] });
  });
});
