import type { PnpInstall, PnpInstallReader, PnpPackage } from "./pnp-install-reader";

/** What a test says about a package; the rest is filled in. */
export type FakePnpPackage = {
  id: string;
  directory: string;
  isWorkspace?: boolean;
  /** Keyed by the name it asks for each by, to the id of what that is. */
  dependencies?: Record<string, string>;
};

/** An install reader that hands back an install it was built with, for a test with no `.pnp.cjs`. */
export class FakePnpInstallReader implements PnpInstallReader {
  private readonly install: PnpInstall;

  constructor(packages: FakePnpPackage[]) {
    const install = new Map<string, PnpPackage>();

    for (const pnpPackage of packages) {
      install.set(pnpPackage.id, {
        id: pnpPackage.id,
        directory: pnpPackage.directory,
        isWorkspace: pnpPackage.isWorkspace ?? false,
        dependencies: new Map(Object.entries(pnpPackage.dependencies ?? {}))
      });
    }

    this.install = install;
  }

  async read(): Promise<PnpInstall> {
    return await Promise.resolve(this.install);
  }
}
