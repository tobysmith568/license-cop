import { beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { createMemoryDir, type MemoryDir } from "./in-memory-file-system";

// Mirrors the cases file-system.spec.ts runs against the disk, so that the double and the real thing
// are held to the same rules.
describe("InMemoryFileSystem", () => {
  let dir: MemoryDir;

  beforeEach(() => {
    dir = createMemoryDir();
  });

  describe("directoryExists", () => {
    it("should be true for an existing directory", async () => {
      dir.mkdir("directory");

      const result = await dir.fileSystem.directoryExists(join(dir.path, "directory"));

      expect(result).toBe(true);
    });

    it("should be true for a directory that only exists because something is in it", async () => {
      dir.write({ "directory/file.txt": "hello" });

      const result = await dir.fileSystem.directoryExists(join(dir.path, "directory"));

      expect(result).toBe(true);
    });

    it("should be false for a missing directory", async () => {
      const result = await dir.fileSystem.directoryExists(join(dir.path, "missing"));

      expect(result).toBe(false);
    });

    it("should be false for a file", async () => {
      dir.write({ "file.txt": "hello" });

      const result = await dir.fileSystem.directoryExists(join(dir.path, "file.txt"));

      expect(result).toBe(false);
    });
  });

  describe("fileExists", () => {
    it("should be true for an existing file", async () => {
      dir.write({ "file.txt": "hello" });

      const result = await dir.fileSystem.fileExists(join(dir.path, "file.txt"));

      expect(result).toBe(true);
    });

    it("should be false for a missing file", async () => {
      const result = await dir.fileSystem.fileExists(join(dir.path, "missing.txt"));

      expect(result).toBe(false);
    });

    it("should be false for a directory", async () => {
      dir.mkdir("directory");

      const result = await dir.fileSystem.fileExists(join(dir.path, "directory"));

      expect(result).toBe(false);
    });
  });

  describe("readText", () => {
    it("should read a file as text", async () => {
      dir.write({ "file.txt": "hello" });

      const result = await dir.fileSystem.readText(join(dir.path, "file.txt"));

      expect(result).toBe("hello");
    });

    it("should serialize an object as JSON", async () => {
      dir.write({ "file.json": { a: 1 } });

      const result = await dir.fileSystem.readText(join(dir.path, "file.json"));

      expect(result).toBe('{"a":1}');
    });

    it("should reject for a missing file", async () => {
      const act = dir.fileSystem.readText(join(dir.path, "missing.txt"));

      await expect(act).rejects.toThrow("ENOENT");
    });

    it("should reject for a directory", async () => {
      dir.mkdir("directory");

      const act = dir.fileSystem.readText(join(dir.path, "directory"));

      await expect(act).rejects.toThrow("ENOENT");
    });
  });

  describe("symlinks", () => {
    it("should be followed by directoryExists and fileExists", async () => {
      dir.write({ "target/file.txt": "hello" });
      dir.symlink("link", "target");

      const isDirectory = await dir.fileSystem.directoryExists(join(dir.path, "link"));
      const isFile = await dir.fileSystem.fileExists(join(dir.path, "link", "file.txt"));

      expect(isDirectory).toBe(true);
      expect(isFile).toBe(true);
    });

    it("should be followed by readText", async () => {
      dir.write({ "target/file.txt": "hello" });
      dir.symlink("link", "target");

      const result = await dir.fileSystem.readText(join(dir.path, "link", "file.txt"));

      expect(result).toBe("hello");
    });

    it("should be neither a file nor a directory when dangling", async () => {
      dir.symlink("link", "missing");

      const isDirectory = await dir.fileSystem.directoryExists(join(dir.path, "link"));
      const isFile = await dir.fileSystem.fileExists(join(dir.path, "link"));

      expect(isDirectory).toBe(false);
      expect(isFile).toBe(false);
    });

    it("should resolve to its target in realpath", async () => {
      dir.mkdir("target");
      dir.symlink("link", "target");

      const result = await dir.fileSystem.realpath(join(dir.path, "link"));

      expect(result).toBe(join(dir.path, "target"));
    });

    it("should resolve a link in the middle of a path in realpath", async () => {
      dir.write({ "target/inner/file.txt": "hello" });
      dir.symlink("link", "target");

      const result = await dir.fileSystem.realpath(join(dir.path, "link", "inner", "file.txt"));

      expect(result).toBe(join(dir.path, "target", "inner", "file.txt"));
    });

    it("should resolve a chain of links", async () => {
      dir.mkdir("target");
      dir.symlink("first", "target");
      dir.symlink("second", "first");

      const result = await dir.fileSystem.realpath(join(dir.path, "second"));

      expect(result).toBe(join(dir.path, "target"));
    });

    it("should reject in realpath for a loop of links", async () => {
      dir.symlink("a", "b");
      dir.symlink("b", "a");

      const act = dir.fileSystem.realpath(join(dir.path, "a"));

      await expect(act).rejects.toThrow("ENOENT");
    });

    it("should reject in realpath for a dangling link", async () => {
      dir.symlink("link", "missing");

      const act = dir.fileSystem.realpath(join(dir.path, "link"));

      await expect(act).rejects.toThrow("ENOENT");
    });
  });
});
