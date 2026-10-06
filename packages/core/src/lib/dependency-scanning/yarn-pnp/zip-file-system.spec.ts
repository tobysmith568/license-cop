import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { npath, type PortablePath } from "@yarnpkg/fslib";
import { ZipFS } from "@yarnpkg/libzip";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ZipFileSystem } from "./zip-file-system";

// The real thing, since reading real zips (Yarn's own library, WASM and all) is the only point of
// this class: the archives here are written with the same library Yarn writes its cache with.
describe("ZipFileSystem", () => {
  let dir: TempDir;
  let fileSystem: ZipFileSystem;
  let zipPath: string;

  beforeEach(async () => {
    dir = await createTempDir();
    fileSystem = new ZipFileSystem();
    zipPath = join(dir.path, "package-npm-1.0.0.zip");

    writeZip(zipPath, { "node_modules/package/package.json": '{"name":"package"}' });
  });

  afterEach(async () => {
    await dir.remove();
  });

  const inZip = (path: string) => join(zipPath, path);

  describe("inside a zip archive", () => {
    it("should read a file", async () => {
      const text = await fileSystem.readText(inZip("node_modules/package/package.json"));

      expect(text).toBe('{"name":"package"}');
    });

    it("should say a file in the archive is a file, and not a directory", async () => {
      const path = inZip("node_modules/package/package.json");

      expect(await fileSystem.fileExists(path)).toBe(true);
      expect(await fileSystem.directoryExists(path)).toBe(false);
    });

    it("should say a folder in the archive is a directory, and not a file", async () => {
      const path = inZip("node_modules/package");

      expect(await fileSystem.directoryExists(path)).toBe(true);
      expect(await fileSystem.fileExists(path)).toBe(false);
    });

    it("should say a missing file in the archive isn't there", async () => {
      const path = inZip("node_modules/package/missing.json");

      expect(await fileSystem.fileExists(path)).toBe(false);
      expect(await fileSystem.directoryExists(path)).toBe(false);
    });

    it("should reject reading a missing file in the archive", async () => {
      const act = fileSystem.readText(inZip("node_modules/package/missing.json"));

      await expect(act).rejects.toThrow();
    });
  });

  describe("outside a zip archive", () => {
    it("should read a file on the disk", async () => {
      await writeFile(join(dir.path, "plain.txt"), "hello");

      const text = await fileSystem.readText(join(dir.path, "plain.txt"));

      expect(text).toBe("hello");
    });

    it("should tell a file on the disk from a directory", async () => {
      await mkdir(join(dir.path, "folder"));
      await writeFile(join(dir.path, "plain.txt"), "hello");

      expect(await fileSystem.fileExists(join(dir.path, "plain.txt"))).toBe(true);
      expect(await fileSystem.directoryExists(join(dir.path, "folder"))).toBe(true);
      expect(await fileSystem.fileExists(join(dir.path, "folder"))).toBe(false);
      expect(await fileSystem.directoryExists(join(dir.path, "plain.txt"))).toBe(false);
    });

    it("should say something that isn't on the disk isn't there", async () => {
      expect(await fileSystem.fileExists(join(dir.path, "missing"))).toBe(false);
      expect(await fileSystem.directoryExists(join(dir.path, "missing"))).toBe(false);
    });

    it("should resolve a real path on the disk", async () => {
      await writeFile(join(dir.path, "plain.txt"), "hello");

      const resolved = await fileSystem.realpath(join(dir.path, "plain.txt"));

      expect(resolved).toBe(await realTempPath(join(dir.path, "plain.txt")));
    });
  });

  // Yarn gives a package with peer dependencies a path under `__virtual__`, where the number after
  // the hash is how many directories up from the folder holding `__virtual__` the real one is
  describe("through a virtual path", () => {
    it("should read the real file", async () => {
      await mkdir(join(dir.path, ".yarn", "real"), { recursive: true });
      await writeFile(join(dir.path, ".yarn", "real", "package.json"), '{"name":"real"}');

      const virtualPath = join(
        dir.path,
        ".yarn",
        "__virtual__",
        "real-virtual-abc123",
        "0",
        "real"
      );
      const text = await fileSystem.readText(join(virtualPath, "package.json"));

      expect(text).toBe('{"name":"real"}');
    });
  });
});

const writeZip = (path: string, files: Record<string, string>) => {
  const zip = new ZipFS(npath.toPortablePath(path), { create: true });

  for (const [filePath, contents] of Object.entries(files)) {
    const portableFilePath = `/${filePath}` as PortablePath;
    const directory = portableFilePath.slice(0, portableFilePath.lastIndexOf("/")) as PortablePath;

    zip.mkdirpSync(directory);
    zip.writeFileSync(portableFilePath, contents);
  }

  zip.saveAndClose();
};

const realTempPath = async (path: string) => {
  const { realpath } = await import("node:fs/promises");

  return await realpath(path);
};
