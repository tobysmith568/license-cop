import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { UnsupportedProjectError } from "../unsupported-project-error";
import { assertNotPlugAndPlay } from "./plug-and-play";

describe("assertNotPlugAndPlay", () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await dir.remove();
  });

  it("should pass for a project with no Plug'n'Play files", async () => {
    await dir.write({ "package.json": {}, "yarn.lock": "" });

    await assertNotPlugAndPlay(dir.path);
  });

  it.each([".pnp.cjs", ".pnp.js"])("should refuse a project with a %s", async file => {
    await dir.write({ [file]: "" });

    const act = assertNotPlugAndPlay(dir.path);

    await expect(act).rejects.toThrow(UnsupportedProjectError);
    await expect(act).rejects.toThrow(`found ${file}`);
  });

  it("should tell the user how to fix it", async () => {
    await dir.write({ ".pnp.cjs": "" });

    const act = assertNotPlugAndPlay(dir.path);

    await expect(act).rejects.toThrow("nodeLinker: node-modules");
  });
});
