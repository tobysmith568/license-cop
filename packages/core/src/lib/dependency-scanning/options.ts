import type { LicenseCopOptions } from "../license-cop";
import type { CheckLicensesResult } from "../result";

export type DependencyScanningOptions = Required<LicenseCopOptions>;

/** Reads one package manager's installed dependencies and classifies them. */
export type DependencyScanner = (
  options: DependencyScanningOptions
) => Promise<CheckLicensesResult>;
