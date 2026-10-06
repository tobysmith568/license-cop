import type { InstallShape } from "../install-shape";
import { PackageManager } from "./package-manager";
import type { PlugAndPlayDetector } from "./plug-and-play-detector";

export class YarnPackageManager extends PackageManager {
  readonly name = "yarn";
  readonly installCommand = "yarn install";
  readonly lockFiles = ["yarn.lock"];

  constructor(private readonly plugAndPlayDetector: PlugAndPlayDetector) {
    super();
  }

  // Yarn 2+ defaults to Plug'n'Play, which writes a resolution map instead of a node_modules;
  // `nodeLinker: node-modules` gets the same flat layout npm has.
  async detectInstallShape(workingDirectory: string): Promise<InstallShape> {
    const plugAndPlayFile = await this.plugAndPlayDetector.find(workingDirectory);

    return plugAndPlayFile === undefined ? "node-modules" : "yarn-pnp";
  }
}
