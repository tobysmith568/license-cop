export class ViolationsError extends Error {
  constructor(public readonly violations: Set<Violation>) {
    super();
  }
}

export interface Violation {
  packageName: string;
  packageVersion: string;
  license: string;
}
