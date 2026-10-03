import type { InstallShape } from "../install-shape";
import { PackageManager } from "./package-manager";

export class NpmPackageManager extends PackageManager {
  readonly name = "npm";
  readonly installCommand = "npm install";
  readonly lockFiles = [];

  async detectInstallShape(): Promise<InstallShape> {
    return await Promise.resolve("node-modules");
  }
}
