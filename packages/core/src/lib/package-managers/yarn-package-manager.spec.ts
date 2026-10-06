import { beforeEach, describe, expect, it } from "bun:test";
import { compose } from "../composition-root";
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

  it("should be node-modules for a project with no Plug'n'Play files", async () => {
    dir.write({ "package.json": {}, "yarn.lock": "" });

    const shape = await yarn.detectInstallShape(dir.path);

    expect(shape).toBe("node-modules");
  });

  it.each([".pnp.cjs", ".pnp.js"])("should be yarn-pnp for a project with a %s", async file => {
    dir.write({ [file]: "" });

    const shape = await yarn.detectInstallShape(dir.path);

    expect(shape).toBe("yarn-pnp");
  });

  it("should be yarn-pnp even when a node_modules is left over from an earlier install", async () => {
    dir.write({ ".pnp.cjs": "", "node_modules/.keep": "" });

    const shape = await yarn.detectInstallShape(dir.path);

    expect(shape).toBe("yarn-pnp");
  });
});
