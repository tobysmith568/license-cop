import { z } from "zod";

export const cliInvocationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("check"),
    directory: z.string(),
    verbose: z.boolean(),
    includeDev: z.boolean(),
    devOnly: z.boolean()
  }),
  z.object({
    kind: z.literal("init"),
    directory: z.string(),
    verbose: z.boolean()
  }),
  z.object({ kind: z.literal("version") }),
  z.object({ kind: z.literal("help") })
]);

export type CliInvocation = z.infer<typeof cliInvocationSchema>;
