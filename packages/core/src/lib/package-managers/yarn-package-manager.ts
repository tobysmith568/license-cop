import type { InstallShape } from "../install-shape";
import { UnsupportedProjectError } from "../unsupported-project-error";
import { PackageManager } from "./package-manager";
import type { PlugAndPlayDetector } from "./plug-and-play-detector";

export class YarnPackageManager extends PackageManager {
  readonly name = "yarn";
  readonly installCommand = "yarn install";
  readonly lockFiles = ["yarn.lock"];

  constructor(private readonly plugAndPlayDetector: PlugAndPlayDetector) {
    super();
  }

  // Scanning a Plug'n'Play project would find no dependencies and so report a pass; refuse instead,
  // until it's supported.
  async detectInstallShape(workingDirectory: string): Promise<InstallShape> {
    const plugAndPlayFile = await this.plugAndPlayDetector.find(workingDirectory);

    if (plugAndPlayFile !== undefined) {
      throw new UnsupportedProjectError(
        `This project uses Yarn Plug'n'Play (found ${plugAndPlayFile}), which license-cop doesn't support yet. ` +
          "Set 'nodeLinker: node-modules' in .yarnrc.yml and run 'yarn install' again."
      );
    }

    return "node-modules";
  }
}
