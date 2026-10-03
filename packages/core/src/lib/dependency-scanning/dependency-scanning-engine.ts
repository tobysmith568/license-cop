import type { LicenseCopOptions } from "../license-cop";
import type { CheckLicensesResult } from "../result";
import type { DependencyClassifier } from "./dependency-classifier";
import { toInclusion, type Inclusion } from "./inclusion";
import type { NormalizedNode } from "./normalized-node";

export type DependencyScanningOptions = Required<Omit<LicenseCopOptions, "onVerbose">>;

/** What a walk is given: where to look and what to cover. */
export type ScanContext = {
  workingDirectory: string;
  inclusion: Inclusion;
};

/** Reads one install shape's dependencies and classifies them. */
export interface DependencyScanningEngine {
  scan(options: DependencyScanningOptions): Promise<CheckLicensesResult>;
}

/**
 * The sequence every engine follows (decide what's in scope, walk the native tree, classify what
 * the walk found), with only the walk left for a subclass to supply.
 */
export abstract class WalkingDependencyScanningEngine implements DependencyScanningEngine {
  constructor(private readonly classifier: DependencyClassifier) {}

  async scan(options: DependencyScanningOptions): Promise<CheckLicensesResult> {
    const { workingDirectory, allowedLicenses, allowedPackages } = options;

    const inclusion = toInclusion(options);
    const nodes = await this.walk({ workingDirectory, inclusion });

    return this.classifier.classify(nodes, { allowedLicenses, allowedPackages });
  }

  protected abstract walk(context: ScanContext): Promise<NormalizedNode[]>;
}
