import { describe, expect, it } from "bun:test";
import { createLicenseChecker } from "./composition-root";
import { FakeTreeLoader } from "./dependency-scanning/node-modules/fake-tree-loader";
import { createMemoryDir } from "./utils/in-memory-file-system";

// `checkLicenses` is `createLicenseChecker(options.onVerbose).check(options)`, so this is where its
// behaviour is pinned down, with the disk and arborist swapped out.
describe("createLicenseChecker", () => {
  it("should report progress to the onVerbose callback the caller gave", async () => {
    const dir = createMemoryDir();
    const messages: string[] = [];
    const checker = createLicenseChecker(message => messages.push(message), {
      fileSystem: dir.fileSystem
    });

    const act = checker.check({
      allowedLicenses: [],
      allowedPackages: [],
      workingDirectory: dir.path
    });

    await expect(act).rejects.toThrow("Cannot find the file");
    expect(messages).toEqual([`Cannot find the package.json: '${dir.path}/package.json'`]);
  });

  it("should run without an onVerbose callback", async () => {
    const dir = createMemoryDir();
    dir.write({ "package.json": { name: "test", version: "1.0.0" } });
    const checker = createLicenseChecker(undefined, {
      fileSystem: dir.fileSystem,
      treeLoader: new FakeTreeLoader([])
    });

    const result = await checker.check({
      allowedLicenses: [],
      allowedPackages: [],
      workingDirectory: dir.path
    });

    expect(result.forbiddenLicenses.size).toBe(0);
  });
});
