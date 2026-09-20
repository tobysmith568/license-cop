export { ConfigError } from "./lib/config/config-error";
export { loadConfig } from "./lib/config/load-config";
export { readPackageJson } from "./lib/dependency/package-json";
export { PackageJsonError } from "./lib/dependency/package-json-error";
export { checkLicenses } from "./lib/license-cop";
export type { LicenseCopOptions } from "./lib/license-cop";
export type { OnVerbose } from "./lib/on-verbose";
export type {
  AllowedPackage,
  CheckLicensesResult,
  ForbiddenLicenseResult,
  LicensedPackage,
  NoLicenseResult
} from "./lib/result";
export { UnsupportedProjectError } from "./lib/unsupported-project-error";
