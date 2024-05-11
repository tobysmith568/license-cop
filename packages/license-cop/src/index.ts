export { checkLicenses } from "./lib/license-cop";
export type { LicenseCopOptions } from "./lib/license-cop";
export type {
  AllowedPackage,
  CheckLicensesResult,
  ForbiddenLicenseResult,
  LicensedPackage,
  NoLicenseResult
} from "./lib/result";

// The following is included to insure that Nx doesn't remove "commander"
// as a dependency from packages/license-cop/package.json.
//
// This is necessary because the @nx/dependency-checks eslint rule will
// remove commander if the license-cop package never imports from it directly.
//
// This approach was chosen over using the ignoredDependencies config option
// to insure that the same eslint rule continues to catch when the commander
// version falls out of sync with the @commander-js/extra-typings version.
import type { Command as _Command } from "commander";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _UnusedCommand = _Command;
