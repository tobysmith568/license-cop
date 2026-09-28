export { PackageJsonError } from "./lib/dependency/package-json-error";
export { checkLicenses } from "./lib/license-cop";
export type { LicenseCopOptions } from "./lib/license-cop";
export { LicenseCopError } from "./lib/license-cop-error";
export { NotInstalledError } from "./lib/not-installed-error";
export type { OnVerbose } from "./lib/on-verbose";
export type {
  AllowedPackage,
  CheckLicensesResult,
  ForbiddenLicenseResult,
  LicensedPackage,
  NoLicenseResult
} from "./lib/result";
export { UnsupportedProjectError } from "./lib/unsupported-project-error";
