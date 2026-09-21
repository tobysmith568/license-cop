import type { DevDependenciesMode } from "@license-cop/core";
import { z } from "zod";

// The modes themselves belong to core, which acts on them; `satisfies` keeps the two from drifting
export const devDependenciesModeSchema = z.enum(
  ["include", "only"] as const satisfies DevDependenciesMode[],
  {
    error: issue =>
      `--dev-dependencies must be 'include' or 'only', but got '${String(issue.input)}'`
  }
);

/** What the command line asks for. Each `error` is what the user sees, so it reads as a sentence. */
export const cliInvocationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("check"),
    directory: z.string(),
    verbose: z.boolean(),
    devDependencies: devDependenciesModeSchema.optional()
  }),
  z.object({
    kind: z.literal("init"),
    directory: z.string(),
    verbose: z.boolean(),
    devDependencies: z.undefined({ error: "'init' does not accept --dev-dependencies" }).optional()
  }),
  z.object({ kind: z.literal("version") }),
  z.object({ kind: z.literal("help") })
]);

export type CliInvocation = z.infer<typeof cliInvocationSchema>;
