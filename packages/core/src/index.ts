export { ConfigError } from "./lib/config/config-error";
export { searchConfig } from "./lib/config/find-config";
export { PackageJsonError } from "./lib/dependency/package-json-error";
export type { DevDependenciesMode } from "./lib/dev-dependencies";
export { checkLicenses } from "./lib/license-cop";
export type { LicenseCopOptions } from "./lib/license-cop";
export { LicenseCopError } from "./lib/license-cop-error";
export { NotInstalledError } from "./lib/not-installed-error";
export type { OnVerbose } from "./lib/on-verbose";
export { resolveCheckOptions } from "./lib/resolve-check-options";
export type { ResolveCheckOptionsInput, ResolvedCheck } from "./lib/resolve-check-options";
export type {
  AllowedPackage,
  CheckLicensesResult,
  ForbiddenLicenseResult,
  LicensedPackage,
  NoLicenseResult
} from "./lib/result";
export { UnsupportedProjectError } from "./lib/unsupported-project-error";
