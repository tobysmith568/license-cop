import { join } from "node:path";
import type { InstallShape } from "../install-shape";
import type { FileSystem } from "../utils/file-system";
import { PackageManager } from "./package-manager";

export class BunPackageManager extends PackageManager {
  readonly name = "bun";
  readonly installCommand = "bun install";
  readonly lockFiles = ["bun.lock", "bun.lockb"];

  constructor(private readonly fileSystem: FileSystem) {
    super();
  }

  // `node_modules/.bun/` only exists for the isolated linker; hoisted bun produces the same flat,
  // npm-compatible node_modules npm and yarn do.
  async detectInstallShape(workingDirectory: string): Promise<InstallShape> {
    const storeDirectory = join(workingDirectory, "node_modules", ".bun");
    const isIsolated = await this.fileSystem.directoryExists(storeDirectory);

    return isIsolated ? "bun-isolated" : "node-modules";
  }
}
