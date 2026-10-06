import { createTempDir, type TempDir } from "@license-cop/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import Module from "node:module";
import { join, resolve } from "node:path";
import { PlugAndPlayDetector } from "../../package-managers/plug-and-play-detector";
import { UnsupportedProjectError } from "../../unsupported-project-error";
import { NodeFileSystem } from "../../utils/file-system";
import { PnpApiInstallReader } from "./pnp-install-reader";

// Real files on the disk: what's being tested is that a `.pnp.cjs` on the disk is loaded and its
// answers read, which is where a change in what Yarn generates would show up. The `.pnp.cjs` files
// here are small stand-ins that export the same API a generated one does.
describe("PnpApiInstallReader", () => {
  let dir: TempDir;
  let reader: PnpApiInstallReader;

  beforeEach(async () => {
    dir = await createTempDir();
    reader = new PnpApiInstallReader(new PlugAndPlayDetector(new NodeFileSystem()));
  });

  afterEach(async () => {
    await dir.remove();
  });

  const writePnp = (body: string, file = ".pnp.cjs") => dir.write({ [file]: body });

  // What a generated `.pnp.cjs` exports: locators, and what the install knows about each
  const apiExporting = (packages: object[]) => `
    const packages = ${JSON.stringify(packages)};
    const locatorOf = entry => ({ name: entry.name, reference: entry.reference });
    module.exports = {
      getAllLocators: () => packages.map(locatorOf),
      getPackageInformation: locator => {
        const entry = packages.find(p => p.name === locator.name && p.reference === locator.reference);
        return entry && {
          packageLocation: entry.location,
          packageDependencies: new Map(entry.dependencies)
        };
      }
    };`;

  it("should read every package, with where it is and what it depends on", async () => {
    await writePnp(
      apiExporting([
        {
          name: "project",
          reference: "workspace:.",
          location: "./",
          dependencies: [["react", "npm:18.3.1"]]
        },
        {
          name: "react",
          reference: "npm:18.3.1",
          location: "./.yarn/cache/react-npm-18.3.1.zip/node_modules/react/",
          dependencies: []
        }
      ])
    );

    const install = await reader.read(dir.path);

    expect([...install.keys()]).toEqual(["project@workspace:.", "react@npm:18.3.1"]);
    expect(install.get("react@npm:18.3.1")).toEqual({
      id: "react@npm:18.3.1",
      directory: resolve(dir.path, ".yarn/cache/react-npm-18.3.1.zip/node_modules/react"),
      isWorkspace: false,
      dependencies: new Map()
    });
  });

  it("should treat a package that is a workspace as one", async () => {
    await writePnp(
      apiExporting([
        { name: "project", reference: "workspace:.", location: "./", dependencies: [] },
        {
          name: "member",
          reference: "workspace:packages/member",
          location: "./packages/member/",
          dependencies: []
        }
      ])
    );

    const install = await reader.read(dir.path);

    expect(install.get("project@workspace:.")?.isWorkspace).toBe(true);
    expect(install.get("member@workspace:packages/member")?.isWorkspace).toBe(true);
  });

  it("should resolve a location relative to the .pnp.cjs, including outside the project", async () => {
    await writePnp(
      apiExporting([
        {
          name: "react",
          reference: "npm:18.3.1",
          location: "../../global-cache/react.zip/node_modules/react/",
          dependencies: []
        }
      ])
    );

    const install = await reader.read(dir.path);

    expect(install.get("react@npm:18.3.1")?.directory).toBe(
      resolve(dir.path, "../../global-cache/react.zip/node_modules/react")
    );
  });

  describe("dependencies", () => {
    const readDependencies = async (dependencies: [string, unknown][]) => {
      await writePnp(
        apiExporting([
          { name: "parent", reference: "npm:1.0.0", location: "./parent/", dependencies }
        ])
      );

      const install = await reader.read(dir.path);

      return install.get("parent@npm:1.0.0")?.dependencies;
    };

    it("should id a dependency by its own name and reference", async () => {
      const dependencies = await readDependencies([["child", "npm:2.0.0"]]);

      expect(dependencies).toEqual(new Map([["child", "child@npm:2.0.0"]]));
    });

    it("should id an alias by the real name it points at, keeping the name it is asked for by", async () => {
      const dependencies = await readDependencies([["aliased", ["real", "npm:2.0.0"]]]);

      expect(dependencies).toEqual(new Map([["aliased", "real@npm:2.0.0"]]));
    });

    it("should leave out a peer dependency nothing provided", async () => {
      const dependencies = await readDependencies([
        ["child", "npm:2.0.0"],
        ["react", null]
      ]);

      expect(dependencies).toEqual(new Map([["child", "child@npm:2.0.0"]]));
    });
  });

  it("should load a .pnp.js, which yarn 2 wrote", async () => {
    await writePnp(
      apiExporting([
        { name: "project", reference: "workspace:.", location: "./", dependencies: [] }
      ]),
      ".pnp.js"
    );

    const install = await reader.read(dir.path);

    expect([...install.keys()]).toEqual(["project@workspace:."]);
  });

  it("should not take over module resolution, which only setup() does", async () => {
    await writePnp(apiExporting([]));
    const resolveFilename = (Module as unknown as { _resolveFilename: unknown })._resolveFilename;

    await reader.read(dir.path);

    expect((Module as unknown as { _resolveFilename: unknown })._resolveFilename).toBe(
      resolveFilename
    );
  });

  describe("what it can't read", () => {
    it("should refuse a directory with no .pnp.cjs", async () => {
      const act = reader.read(join(dir.path, "nothing-here"));

      await expect(act).rejects.toThrow(UnsupportedProjectError);
    });

    it("should refuse a .pnp.cjs that doesn't export the API, naming the file", async () => {
      await writePnp("module.exports = { somethingElse: true };");

      const act = reader.read(dir.path);

      await expect(act).rejects.toThrow(UnsupportedProjectError);
      await expect(act).rejects.toThrow(".pnp.cjs doesn't have the API");
    });

    it("should refuse a .pnp.cjs that exports nothing", async () => {
      await writePnp("module.exports = null;");

      const act = reader.read(dir.path);

      await expect(act).rejects.toThrow(UnsupportedProjectError);
    });

    it("should refuse a .pnp.cjs that throws when loaded, saying why", async () => {
      await writePnp('throw new Error("kaboom");');

      const act = reader.read(dir.path);

      await expect(act).rejects.toThrow(UnsupportedProjectError);
      await expect(act).rejects.toThrow("kaboom");
    });
  });
});
