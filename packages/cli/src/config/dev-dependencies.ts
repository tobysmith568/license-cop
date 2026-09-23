/** What `--dev-dependencies` can ask for. Leaving it out means "whatever the config says". */
export type DevDependenciesMode = "include" | "only";

export type DevDependencyOptions = {
  includeDevDependencies: boolean;
  devDependenciesOnly: boolean;
};

/**
 * The `--dev-dependencies` flag, when given, decides on its own and the config file's keys are
 * ignored; only when it's absent do the config keys apply. This means the two options are never
 * both true when they come from the flag.
 */
export const resolveDevDependencyOptions = (
  flag: DevDependenciesMode | undefined,
  config: DevDependencyOptions
): DevDependencyOptions => {
  switch (flag) {
    case undefined:
      return {
        includeDevDependencies: config.includeDevDependencies,
        devDependenciesOnly: config.devDependenciesOnly
      };
    case "include":
      return { includeDevDependencies: true, devDependenciesOnly: false };
    case "only":
      return { includeDevDependencies: false, devDependenciesOnly: true };
    default: {
      const _exhaustiveCheck: never = flag;
      throw new Error(`Unknown dev dependencies mode: ${_exhaustiveCheck}`);
    }
  }
};
