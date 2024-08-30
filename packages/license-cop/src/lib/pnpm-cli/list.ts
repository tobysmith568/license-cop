import { exec } from "node:child_process";
import { promisify } from "node:util";
import { ZodType, z } from "zod";

const execAsync = promisify(exec);

export type DependencyType = "all" | "prod" | "dev";

type ListOptions = {
  workingDirectory: string;
  dependencyType: DependencyType;
};

const leafNodeValidator = z.object({
  from: z.string(),
  version: z.string(),
  path: z.string()
});

type Node = z.infer<typeof leafNodeValidator> & {
  dependencies: Record<string, Node>;
};

const nodeValidator: ZodType<Node> = leafNodeValidator.extend({
  dependencies: z.record(z.lazy(() => nodeValidator))
});

export const list = async ({ workingDirectory, dependencyType }: ListOptions): Promise<Node> => {
  const args = ["list", "--parseable", "--depth", "Infinity"];

  if (dependencyType === "prod") {
    args.push("--prod");
  } else if (dependencyType === "dev") {
    args.push("--dev");
  }

  const { stdout } = await execAsync(`pnpm ${args.join(" ")}`, { cwd: workingDirectory });
  const parseResult = nodeValidator.safeParse(JSON.parse(stdout));

  if (!parseResult.success) {
    throw new Error(parseResult.error.errors.join(", "));
  }

  return parseResult.data;
};
