import { z } from "zod";
import { ConfigError } from "./config-error";

const rawConfigParser = z.object({
  extends: z.string().optional(),
  licenses: z.array(z.string()).optional(),
  packages: z.array(z.string()).optional(),
  includeDevDependencies: z.boolean().optional(),
  devDependenciesOnly: z.boolean().optional(),
  directory: z.string().optional()
});

/** A config as written, with none of the defaults applied. */
export type RawConfig = z.infer<typeof rawConfigParser>;

export type Config = {
  extends: string | undefined;
  licenses: string[];
  packages: string[];
  includeDevDependencies: boolean;
  devDependenciesOnly: boolean;
};

export const parseConfig = (config: unknown): Config => {
  const rawConfig = parseRawConfig(config);
  return applyConfigDefaults(rawConfig);
};

/**
 * Validates a config without applying any defaults. Configs must be merged in this form,
 * otherwise a default on the child would override a value that was explicitly set on its parent.
 */
export const parseRawConfig = (config: unknown): RawConfig => {
  const parseResult = rawConfigParser.safeParse(config);

  if (!parseResult.success) {
    throw new ConfigError(parseResult.error.message);
  }

  return parseResult.data;
};

export const applyConfigDefaults = (config: RawConfig): Config => ({
  extends: config.extends,
  licenses: config.licenses ?? [],
  packages: config.packages ?? [],
  includeDevDependencies: config.includeDevDependencies ?? false,
  devDependenciesOnly: config.devDependenciesOnly ?? false
});
