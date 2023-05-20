import { SpdxExpression } from "./spdx/types/spdx-expression";

export interface CheckLicensesResult {
  allowedPackages: Set<AllowedPackage>;
  allowedLicenses: Set<LicensedPackage>;
  noLicenses: Set<NoLicenseResult>;
  forbiddenLicenses: Set<ForbiddenLicenseResult>;
}

export interface AllowedPackage {
  name: string;
  version: string;
}

export interface LicensedPackage {
  name: string;
  version: string;
  spdxExpression: string;
  licenses: SpdxExpression;
}

export interface NoLicenseResult {
  name: string;
  version: string;
}

export interface ForbiddenLicenseResult {
  name: string;
  version: string;
  spdxExpression: string;
  licenseIdentifiers: string;
}
