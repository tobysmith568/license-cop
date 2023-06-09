import { z } from "zod";
import { ConfigError } from "./config-error";

const configParser = z
  .object({
    extends: z.string().optional(),
    licenses: z.array(z.string()).optional(),
    packages: z.array(z.string()).optional(),
    includeDevDependencies: z.boolean().optional(),
    devDependenciesOnly: z.boolean().optional(),
    directory: z.string().optional()
  })
  .transform(c => ({
    extends: c.extends,
    licenses: c.licenses ?? [],
    packages: c.packages ?? [],
    includeDevDependencies: c.includeDevDependencies ?? false,
    devDependenciesOnly: c.devDependenciesOnly ?? false
  }));

export type Config = z.infer<typeof configParser>;

export const parseConfig = (config: unknown): Config => {
  const parseResult = configParser.safeParse(config);

  if (!parseResult.success) {
    throw new ConfigError(parseResult.error.message);
  }

  return parseResult.data;
};
