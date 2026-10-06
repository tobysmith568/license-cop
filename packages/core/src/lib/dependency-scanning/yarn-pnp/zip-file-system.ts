import { NodeFS, npath, VirtualFS, type FakeFS, type PortablePath } from "@yarnpkg/fslib";
import { getLibzipSync, ZipOpenFS } from "@yarnpkg/libzip";
import type { FileSystem } from "../../utils/file-system";

/**
 * A `FileSystem` that can also read inside the zip archives Yarn's Plug'n'Play keeps its packages
 * in, with the same path spelling Yarn itself uses (`.../foo.zip/node_modules/foo/package.json`),
 * and through the `__virtual__` paths it gives packages that have peer dependencies. Paths that
 * aren't inside an archive are read from the disk as normal.
 */
export class ZipFileSystem implements FileSystem {
  // Opened on first use: it instantiates a WASM module, which a scan of any other install shape
  // never needs.
  private zipAwareFs: FakeFS<PortablePath> | undefined;

  async fileExists(path: string): Promise<boolean> {
    const stats = await this.statOrUndefined(path);

    return stats?.isFile() ?? false;
  }

  async directoryExists(path: string): Promise<boolean> {
    const stats = await this.statOrUndefined(path);

    return stats?.isDirectory() ?? false;
  }

  async readText(path: string): Promise<string> {
    const fs = this.open();
    const portablePath = npath.toPortablePath(path);

    return await fs.readFilePromise(portablePath, "utf8");
  }

  async realpath(path: string): Promise<string> {
    const fs = this.open();
    const portablePath = npath.toPortablePath(path);

    const resolved = await fs.realpathPromise(portablePath);

    return npath.fromPortablePath(resolved);
  }

  private async statOrUndefined(path: string) {
    const fs = this.open();
    const portablePath = npath.toPortablePath(path);

    try {
      return await fs.statPromise(portablePath);
    } catch {
      return undefined;
    }
  }

  private open(): FakeFS<PortablePath> {
    if (this.zipAwareFs === undefined) {
      const libzip = getLibzipSync();
      const zipFs = new ZipOpenFS({ libzip, readOnlyArchives: true, baseFs: new NodeFS() });

      this.zipAwareFs = new VirtualFS({ baseFs: zipFs });
    }

    return this.zipAwareFs;
  }
}
