import { z } from "zod";

const configParser = z
  .object({
    extends: z.string().optional(),
    licenses: z.array(z.string()).optional(),
    packages: z.array(z.string()).optional()
  })
  .transform(c => ({
    extends: c.extends,
    licenses: c.licenses ?? [],
    packages: c.packages ?? []
  }));

export type Config = z.infer<typeof configParser>;

export const parseConfig = (config: unknown): Config => {
  const parseResult = configParser.safeParse(config);

  if (!parseResult.success) {
    console.error("Invalid config file");
    throw new Error(parseResult.error.message);
  }

  return parseResult.data;
};
