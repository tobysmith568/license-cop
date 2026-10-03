import type {
  AllowedPackage,
  CheckLicensesResult,
  ForbiddenLicenseResult,
  LicensedPackage,
  NoLicenseResult
} from "../result";

/**
 * Collects what a classification finds. Each bucket is keyed by the dependency's id, so a package
 * reached by several routes is only reported once.
 */
export class ResultTally {
  private readonly allowedPackages = new Map<string, AllowedPackage>();
  private readonly allowedLicenses = new Map<string, LicensedPackage>();
  private readonly noLicenses = new Map<string, NoLicenseResult>();
  private readonly forbiddenLicenses = new Map<string, ForbiddenLicenseResult>();

  addAllowedPackage(id: string, found: AllowedPackage): void {
    this.allowedPackages.set(id, found);
  }

  addAllowedLicense(id: string, found: LicensedPackage): void {
    this.allowedLicenses.set(id, found);
  }

  addNoLicense(id: string, found: NoLicenseResult): void {
    this.noLicenses.set(id, found);
  }

  addForbiddenLicense(id: string, found: ForbiddenLicenseResult): void {
    this.forbiddenLicenses.set(id, found);
  }

  toResult(): CheckLicensesResult {
    return {
      allowedPackages: new Set(this.allowedPackages.values()),
      allowedLicenses: new Set(this.allowedLicenses.values()),
      noLicenses: new Set(this.noLicenses.values()),
      forbiddenLicenses: new Set(this.forbiddenLicenses.values())
    };
  }
}
