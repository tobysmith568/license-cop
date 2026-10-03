import { beforeEach, describe, expect, it } from "bun:test";
import { compose } from "../composition-root";
import { createMemoryDir, type MemoryDir } from "../utils/in-memory-file-system";
import type { PackageManagerName } from "./package-manager";
import type { PackageManagerDetector } from "./package-manager-detector";

describe("PackageManagerDetector", () => {
  let dir: MemoryDir;
  let packageManagerDetector: PackageManagerDetector;

  beforeEach(() => {
    dir = createMemoryDir();

    const services = compose(undefined, { fileSystem: dir.fileSystem });
    packageManagerDetector = services.packageManagerDetector;
  });

  const packageJson = (extra: object = {}) => ({ name: "test", version: "1.0.0", ...extra });

  describe("from the packageManager field", () => {
    it.each<[string, PackageManagerName]>([
      ["npm@10.0.0", "npm"],
      ["yarn@1.22.19", "yarn"],
      ["yarn@3.8.7", "yarn"],
      ["pnpm@10.28.1", "pnpm"],
      ["bun@1.1.42", "bun"]
    ])("should resolve %s to %s", async (packageManager, expected) => {
      dir.write({ "package.json": packageJson({ packageManager }) });

      const result = await packageManagerDetector.detect(dir.path);

      expect(result.name).toBe(expected);
    });

    it("should prefer the packageManager field over lock files", async () => {
      dir.write({
        "package.json": packageJson({ packageManager: "npm@10.0.0" }),
        "pnpm-lock.yaml": ""
      });

      const result = await packageManagerDetector.detect(dir.path);

      expect(result.name).toBe("npm");
    });

    it("should fall back to lock file discovery for an unrecognised package manager", async () => {
      dir.write({
        "package.json": packageJson({ packageManager: "foo@1.0.0" }),
        "pnpm-lock.yaml": ""
      });

      const result = await packageManagerDetector.detect(dir.path);

      expect(result.name).toBe("pnpm");
    });
  });

  describe("from lock files", () => {
    it("should resolve yarn from yarn.lock", async () => {
      dir.write({ "package.json": packageJson(), "yarn.lock": "" });

      const result = await packageManagerDetector.detect(dir.path);

      expect(result.name).toBe("yarn");
    });

    it("should resolve pnpm from pnpm-lock.yaml", async () => {
      dir.write({ "package.json": packageJson(), "pnpm-lock.yaml": "" });

      const result = await packageManagerDetector.detect(dir.path);

      expect(result.name).toBe("pnpm");
    });

    it("should resolve bun from bun.lock", async () => {
      dir.write({ "package.json": packageJson(), "bun.lock": "" });

      const result = await packageManagerDetector.detect(dir.path);

      expect(result.name).toBe("bun");
    });

    it("should resolve bun from bun.lockb", async () => {
      dir.write({ "package.json": packageJson(), "bun.lockb": "" });

      const result = await packageManagerDetector.detect(dir.path);

      expect(result.name).toBe("bun");
    });

    it("should prefer yarn when there are multiple lock files", async () => {
      dir.write({ "package.json": packageJson(), "yarn.lock": "", "pnpm-lock.yaml": "" });

      const result = await packageManagerDetector.detect(dir.path);

      expect(result.name).toBe("yarn");
    });

    it("should prefer pnpm over bun.lock", async () => {
      dir.write({ "package.json": packageJson(), "pnpm-lock.yaml": "", "bun.lock": "" });

      const result = await packageManagerDetector.detect(dir.path);

      expect(result.name).toBe("pnpm");
    });

    it("should default to npm when there is no other information", async () => {
      dir.write({ "package.json": packageJson(), "package-lock.json": "{}" });

      const result = await packageManagerDetector.detect(dir.path);

      expect(result.name).toBe("npm");
    });
  });

  it("should work when the package.json has no name or version, like a workspace root", async () => {
    dir.write({ "package.json": { private: true, packageManager: "pnpm@10.28.1" } });

    const result = await packageManagerDetector.detect(dir.path);

    expect(result.name).toBe("pnpm");
  });

  it("should throw when the packageManager field isn't a string", async () => {
    dir.write({ "package.json": packageJson({ packageManager: 1 }) });

    const act = packageManagerDetector.detect(dir.path);

    await expect(act).rejects.toThrow("Unable to parse package.json");
  });

  it("should throw when there is no package.json", async () => {
    const act = packageManagerDetector.detect(dir.path);

    await expect(act).rejects.toThrow("Cannot find the file");
  });
});
