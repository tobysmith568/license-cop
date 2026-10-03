import type { InstallShape } from "../install-shape";
import { PackageManager } from "./package-manager";

export class PnpmPackageManager extends PackageManager {
  readonly name = "pnpm";
  readonly installCommand = "pnpm install";
  readonly lockFiles = ["pnpm-lock.yaml"];

  async detectInstallShape(): Promise<InstallShape> {
    return await Promise.resolve("pnpm-store");
  }
}
