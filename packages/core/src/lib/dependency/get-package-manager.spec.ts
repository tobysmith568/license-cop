import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createTempDir, type TempDir } from "../test-utils/temp-dir";
import { getPackageManager, type PackageManager } from "./get-package-manager";

describe("getPackageManager", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  const packageJson = (extra: object = {}) => ({ name: "test", version: "1.0.0", ...extra });

  describe("from the packageManager field", () => {
    it.each<[string, PackageManager]>([
      ["npm@10.0.0", "npm"],
      ["yarn@1.22.19", "yarn"],
      ["yarn@3.8.7", "yarn"],
      ["pnpm@10.28.1", "pnpm"]
    ])("should resolve %s to %s", async (packageManager, expected) => {
      await dir.write({ "package.json": packageJson({ packageManager }) });

      const result = await getPackageManager(dir.path);

      expect(result).toBe(expected);
    });

    it("should prefer the packageManager field over lock files", async () => {
      await dir.write({
        "package.json": packageJson({ packageManager: "npm@10.0.0" }),
        "pnpm-lock.yaml": ""
      });

      const result = await getPackageManager(dir.path);

      expect(result).toBe("npm");
    });

    it("should fall back to lock file discovery for an unrecognised package manager", async () => {
      await dir.write({
        "package.json": packageJson({ packageManager: "bun@1.0.0" }),
        "pnpm-lock.yaml": ""
      });

      const result = await getPackageManager(dir.path);

      expect(result).toBe("pnpm");
    });
  });

  describe("from lock files", () => {
    it("should resolve yarn from yarn.lock", async () => {
      await dir.write({ "package.json": packageJson(), "yarn.lock": "" });

      const result = await getPackageManager(dir.path);

      expect(result).toBe("yarn");
    });

    it("should resolve pnpm from pnpm-lock.yaml", async () => {
      await dir.write({ "package.json": packageJson(), "pnpm-lock.yaml": "" });

      const result = await getPackageManager(dir.path);

      expect(result).toBe("pnpm");
    });

    it("should prefer yarn when there are multiple lock files", async () => {
      await dir.write({ "package.json": packageJson(), "yarn.lock": "", "pnpm-lock.yaml": "" });

      const result = await getPackageManager(dir.path);

      expect(result).toBe("yarn");
    });

    it("should default to npm when there is no other information", async () => {
      await dir.write({ "package.json": packageJson(), "package-lock.json": "{}" });

      const result = await getPackageManager(dir.path);

      expect(result).toBe("npm");
    });
  });

  it("should work when the package.json has no name or version, like a workspace root", async () => {
    await dir.write({ "package.json": { private: true, packageManager: "pnpm@10.28.1" } });

    const result = await getPackageManager(dir.path);

    expect(result).toBe("pnpm");
  });

  it("should throw when the packageManager field isn't a string", async () => {
    await dir.write({ "package.json": packageJson({ packageManager: 1 }) });

    const act = getPackageManager(dir.path);

    await expect(act).rejects.toThrow("Unable to parse package.json");
  });

  it("should throw when there is no package.json", async () => {
    const act = getPackageManager(dir.path);

    await expect(act).rejects.toThrow("Cannot find the file");
  });
});
