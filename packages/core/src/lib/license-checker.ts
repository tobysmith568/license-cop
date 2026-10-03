import type { EngineRegistry } from "./dependency-scanning/engine-registry";
import type { InstallationVerifier } from "./dependency/installation-verifier";
import type { LicenseCopOptions } from "./license-cop";
import type { OptionsNormalizer } from "./options-normalizer";
import type { PackageManagerDetector } from "./package-managers/package-manager-detector";
import type { CheckLicensesResult } from "./result";

/** Checks a project's dependencies' licenses: the one place the steps of a check are ordered. */
export class LicenseChecker {
  constructor(
    private readonly optionsNormalizer: OptionsNormalizer,
    private readonly packageManagerDetector: PackageManagerDetector,
    private readonly installationVerifier: InstallationVerifier,
    private readonly engines: EngineRegistry
  ) {}

  async check(options: LicenseCopOptions): Promise<CheckLicensesResult> {
    const scanOptions = this.optionsNormalizer.normalize(options);
    const { workingDirectory } = scanOptions;

    const packageManager = await this.packageManagerDetector.detect(workingDirectory);
    const installShape = await packageManager.detectInstallShape(workingDirectory);

    await this.installationVerifier.verify(workingDirectory, packageManager, scanOptions);

    const engine = this.engines.get(installShape);

    return await engine.scan(scanOptions);
  }
}
