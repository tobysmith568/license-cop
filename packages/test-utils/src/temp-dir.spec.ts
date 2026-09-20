import { afterEach, describe, expect, it } from "bun:test";
import { access, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createTempDir, type TempDir } from "./temp-dir";

describe("createTempDir", () => {
  const created: TempDir[] = [];

  const create = async (options?: Parameters<typeof createTempDir>[0]) => {
    const dir = await createTempDir(options);
    created.push(dir);
    return dir;
  };

  afterEach(async () => {
    for (const dir of created.splice(0)) {
      await dir.remove();
    }
  });

  it("should create a directory with the given prefix", async () => {
    const dir = await create({ prefix: "my-prefix-" });

    await access(dir.path);
    expect(basename(dir.path)).toStartWith("my-prefix-");
  });

  it("should write strings as they are and objects as JSON, creating parent directories", async () => {
    const dir = await create();

    await dir.write({ "a.txt": "plain", "nested/b.json": { value: 1 } });

    expect(await readFile(join(dir.path, "a.txt"), "utf8")).toBe("plain");
    expect(JSON.parse(await readFile(join(dir.path, "nested/b.json"), "utf8"))).toEqual({
      value: 1
    });
  });

  it("should delete the directory when removed", async () => {
    const dir = await create();

    await dir.remove();

    await expect(access(dir.path)).rejects.toThrow();
  });

  it("should leave the directory behind when KEEP_TEMP is set", async () => {
    const dir = await create();
    const write = spyOnStdout();
    process.env["KEEP_TEMP"] = "1";

    try {
      await dir.remove();
    } finally {
      delete process.env["KEEP_TEMP"];
      write.restore();
    }

    await access(dir.path);
    expect(write.output()).toContain(dir.path);
  });
});

const spyOnStdout = () => {
  const original = process.stdout.write.bind(process.stdout);
  let output = "";

  process.stdout.write = ((chunk: string) => {
    output += chunk;
    return true;
  }) as typeof process.stdout.write;

  return {
    output: () => output,
    restore: () => {
      process.stdout.write = original;
    }
  };
};
