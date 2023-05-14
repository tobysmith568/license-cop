export type ForbiddenLicenseViolation = {
  type: "forbidden-license";
  packageName: string;
  packageVersion: string;
  license: string;
};

export type MultipleLicensesViolation = {
  type: "multiple-licenses";
  packageName: string;
  packageVersion: string;
  licenses: string[];
};

export type NoLicenseViolation = {
  type: "no-license";
  packageName: string;
  packageVersion: string;
};

export type Violation = ForbiddenLicenseViolation | MultipleLicensesViolation | NoLicenseViolation;
export type ViolationType = Violation["type"];

export class ViolationsError extends Error {
  constructor(public readonly violations: Set<Violation>) {
    super();
  }
}
