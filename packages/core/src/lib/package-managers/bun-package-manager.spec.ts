import { beforeEach, describe, expect, it } from "bun:test";
import { compose } from "../composition-root";
import { createMemoryDir, type MemoryDir } from "../utils/in-memory-file-system";
import type { BunPackageManager } from "./bun-package-manager";

describe("BunPackageManager.detectInstallShape", () => {
  let dir: MemoryDir;
  let bun: BunPackageManager;

  beforeEach(() => {
    dir = createMemoryDir();

    const services = compose(undefined, { fileSystem: dir.fileSystem });
    bun = services.packageManagers.bun;
  });

  it("should be the hoisted (npm-shaped) layout when node_modules/.bun is absent", async () => {
    dir.write({ "node_modules/prod/package.json": { name: "prod", version: "1.0.0" } });

    const shape = await bun.detectInstallShape(dir.path);

    expect(shape).toBe("node-modules");
  });

  it("should be the hoisted layout when there is no node_modules at all", async () => {
    const shape = await bun.detectInstallShape(dir.path);

    expect(shape).toBe("node-modules");
  });

  it("should be the isolated layout when node_modules/.bun is present", async () => {
    dir.write({ "node_modules/.bun/prod@1.0.0/node_modules/prod/package.json": {} });

    const shape = await bun.detectInstallShape(dir.path);

    expect(shape).toBe("bun-isolated");
  });

  it("should not take a file called .bun for the isolated layout", async () => {
    dir.write({ "node_modules/.bun": "" });

    const shape = await bun.detectInstallShape(dir.path);

    expect(shape).toBe("node-modules");
  });
});
