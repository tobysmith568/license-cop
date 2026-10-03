import { beforeEach, describe, expect, it } from "bun:test";
import { NullLogger } from "../logging/logger";
import { RecordingLogger } from "../logging/recording-logger";
import { createMemoryDir, type MemoryDir } from "../utils/in-memory-file-system";
import { PackageJsonError } from "./package-json-error";
import { FilePackageJsonReader } from "./package-json-reader";

describe("FilePackageJsonReader", () => {
  let dir: MemoryDir;
  let reader: FilePackageJsonReader;

  beforeEach(() => {
    dir = createMemoryDir();
    reader = new FilePackageJsonReader(dir.fileSystem, new NullLogger());
  });

  describe("read", () => {
    it("should read a valid package.json", async () => {
      dir.write({ "package.json": { name: "test", version: "1.2.3", license: "MIT" } });

      const result = await reader.read(`${dir.path}/package.json`);

      expect(result.name).toBe("test");
      expect(result.version).toBe("1.2.3");
      expect(result.licenseExpression).toBe("MIT");
    });

    it("should read a package.json containing comments and trailing commas", async () => {
      dir.write({
        "package.json": `{
          // a comment
          "name": "test",
          "version": "1.2.3",
        }`
      });

      const result = await reader.read(`${dir.path}/package.json`);

      expect(result.name).toBe("test");
    });

    it("should throw when the file doesn't exist", async () => {
      const logger = new RecordingLogger();
      const loggingReader = new FilePackageJsonReader(dir.fileSystem, logger);

      const act = loggingReader.read(`${dir.path}/package.json`);

      await expect(act).rejects.toThrow(PackageJsonError);
      await expect(act).rejects.toThrow("Cannot find the file");
      expect(logger.messages).toHaveLength(1);
    });

    it("should throw when the path is a directory", async () => {
      dir.write({ "package.json/inner.txt": "" });

      const act = reader.read(`${dir.path}/package.json`);

      await expect(act).rejects.toThrow(PackageJsonError);
      await expect(act).rejects.toThrow("Cannot find the file");
    });

    it("should throw when the file isn't valid JSON", async () => {
      dir.write({ "package.json": "not json" });

      const act = reader.read(`${dir.path}/package.json`);

      await expect(act).rejects.toThrow(PackageJsonError);
      await expect(act).rejects.toThrow("Unable to parse package.json");
    });

    it("should throw a helpful error when the package.json doesn't match the schema", async () => {
      dir.write({ "package.json": { name: "test", version: 1 } });

      const act = reader.read(`${dir.path}/package.json`);

      await expect(act).rejects.toThrow(PackageJsonError);
      await expect(act).rejects.toThrow("Unable to parse package.json");
    });
  });

  describe("readDeclaredDependencies", () => {
    it("should list the names of each kind of dependency", async () => {
      dir.write({
        "package.json": {
          dependencies: { a: "1.0.0", b: "^2.0.0" },
          devDependencies: { c: "3.0.0" },
          optionalDependencies: { d: "4.0.0" }
        }
      });

      const result = await reader.readDeclaredDependencies(`${dir.path}/package.json`);

      expect(result).toEqual({
        dependencies: ["a", "b"],
        devDependencies: ["c"],
        optionalDependencies: ["d"]
      });
    });

    it("should return empty lists when nothing is declared", async () => {
      dir.write({ "package.json": {} });

      const result = await reader.readDeclaredDependencies(`${dir.path}/package.json`);

      expect(result).toEqual({ dependencies: [], devDependencies: [], optionalDependencies: [] });
    });

    it("should not need a name or version", async () => {
      dir.write({ "package.json": { private: true, dependencies: { a: "1.0.0" } } });

      const result = await reader.readDeclaredDependencies(`${dir.path}/package.json`);

      expect(result.dependencies).toEqual(["a"]);
    });

    it("should throw when the file is missing", async () => {
      const act = reader.readDeclaredDependencies(`${dir.path}/package.json`);

      await expect(act).rejects.toThrow("Cannot find the file");
    });

    it("should throw when the dependencies aren't a map of strings", async () => {
      dir.write({ "package.json": { dependencies: ["a"] } });

      const act = reader.readDeclaredDependencies(`${dir.path}/package.json`);

      await expect(act).rejects.toThrow(PackageJsonError);
      await expect(act).rejects.toThrow("Unable to parse package.json");
    });
  });
});
