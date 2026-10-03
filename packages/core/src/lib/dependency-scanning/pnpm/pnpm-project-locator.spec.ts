import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { LockfilePnpmProjectLocator } from "./pnpm-project-locator";

describe("LockfilePnpmProjectLocator", () => {
  const locator = new LockfilePnpmProjectLocator();

  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  const lockfile = (importers: string[]) => {
    const entries = importers.map(importer => `  ${importer}: {}`).join("\n");

    return `lockfileVersion: '9.0'\n\nimporters:\n\n${entries}\n`;
  };

  it("should be just the project itself when there is no lockfile", async () => {
    const projects = await locator.locate(dir.path);

    expect(projects).toEqual([dir.path]);
  });

  it("should be just the project itself when the lockfile only covers it", async () => {
    await dir.write({ "pnpm-lock.yaml": lockfile(["."]) });

    const projects = await locator.locate(dir.path);

    expect(projects).toEqual([dir.path]);
  });

  it("should be every project the lockfile covers, for a workspace", async () => {
    await dir.write({ "pnpm-lock.yaml": lockfile([".", "packages/a", "packages/b"]) });

    const projects = await locator.locate(dir.path);

    expect(projects).toEqual([
      dir.path,
      join(dir.path, "packages/a"),
      join(dir.path, "packages/b")
    ]);
  });

  it("should be just the project itself when the lockfile covers no projects", async () => {
    await dir.write({ "pnpm-lock.yaml": "lockfileVersion: '9.0'\n" });

    const projects = await locator.locate(dir.path);

    expect(projects).toEqual([dir.path]);
  });
});
