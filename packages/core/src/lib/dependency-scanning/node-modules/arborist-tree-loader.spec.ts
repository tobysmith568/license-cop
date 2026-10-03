import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { ArboristTreeLoader } from "./arborist-tree-loader";

describe("ArboristTreeLoader", () => {
  const loader = new ArboristTreeLoader();

  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  const installedPackage = (name: string) => ({
    [`node_modules/${name}/package.json`]: { name, version: "1.0.0" }
  });

  it("should load what is installed in node_modules", async () => {
    await dir.write({
      "package.json": {
        name: "project",
        version: "0.0.0",
        dependencies: { prod: "1.0.0" },
        devDependencies: { dev: "1.0.0" }
      },
      ...installedPackage("prod"),
      ...installedPackage("dev")
    });

    const tree = await loader.load(dir.path);

    const names = [...tree.children.keys()].sort();
    expect(names).toEqual(["dev", "prod"]);
  });

  it("should flag a package that is only a dev dependency", async () => {
    await dir.write({
      "package.json": {
        name: "project",
        version: "0.0.0",
        dependencies: { prod: "1.0.0" },
        devDependencies: { dev: "1.0.0" }
      },
      ...installedPackage("prod"),
      ...installedPackage("dev")
    });

    const tree = await loader.load(dir.path);

    expect(tree.children.get("prod")?.dev).toBe(false);
    expect(tree.children.get("dev")?.dev).toBe(true);
  });

  it("should give each package its identity and where it is installed", async () => {
    await dir.write({
      "package.json": { name: "project", version: "0.0.0", dependencies: { prod: "1.0.0" } },
      ...installedPackage("prod")
    });

    const tree = await loader.load(dir.path);

    const prod = tree.children.get("prod");
    expect(prod?.pkgid).toBe("prod@1.0.0");
    expect(prod?.realpath).toBe(`${dir.path}/node_modules/prod`);
  });

  it("should load nothing for a project with no node_modules", async () => {
    await dir.write({ "package.json": { name: "project", version: "0.0.0" } });

    const tree = await loader.load(dir.path);

    expect(tree.children.size).toBe(0);
  });
});
