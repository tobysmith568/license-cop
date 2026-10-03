/**
 * Which kinds of dependency a scan covers. Optional dependencies count as production ones, since an
 * optional dependency that got installed is shipped like any other.
 */
export type Inclusion = {
  production: boolean;
  development: boolean;
};

export type InclusionScope = {
  includeDevDependencies: boolean;
  devDependenciesOnly: boolean;
};

export const toInclusion = (scope: InclusionScope): Inclusion => ({
  production: !scope.devDependenciesOnly,
  development: scope.includeDevDependencies || scope.devDependenciesOnly
});

/** For walks that can only decide per node, whether a node's dev flag puts it in scope. */
export const isIncluded = (inclusion: Inclusion, isDevelopment: boolean): boolean =>
  isDevelopment ? inclusion.development : inclusion.production;
