import { beforeEach, describe, expect, it } from "bun:test";
import { compose } from "../composition-root";
import { UnsupportedProjectError } from "../unsupported-project-error";
import { createMemoryDir, type MemoryDir } from "../utils/in-memory-file-system";
import type { YarnPackageManager } from "./yarn-package-manager";

describe("YarnPackageManager.detectInstallShape", () => {
  let dir: MemoryDir;
  let yarn: YarnPackageManager;

  beforeEach(() => {
    dir = createMemoryDir();

    const services = compose(undefined, { fileSystem: dir.fileSystem });
    yarn = services.packageManagers.yarn;
  });

  it("should pass for a project with no Plug'n'Play files", async () => {
    dir.write({ "package.json": {}, "yarn.lock": "" });

    const shape = await yarn.detectInstallShape(dir.path);

    expect(shape).toBe("node-modules");
  });

  it.each([".pnp.cjs", ".pnp.js"])("should refuse a project with a %s", async file => {
    dir.write({ [file]: "" });

    const act = yarn.detectInstallShape(dir.path);

    await expect(act).rejects.toThrow(UnsupportedProjectError);
    await expect(act).rejects.toThrow(`found ${file}`);
  });

  it("should tell the user how to fix it", async () => {
    dir.write({ ".pnp.cjs": "" });

    const act = yarn.detectInstallShape(dir.path);

    await expect(act).rejects.toThrow("nodeLinker: node-modules");
  });
});
