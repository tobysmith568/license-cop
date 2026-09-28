import { join } from "path";
import { fileURLToPath } from "url";

const workspaceRoot = fileURLToPath(new URL("../../../..", import.meta.url));

export const cliBinPath = join(workspaceRoot, "packages/cli/dist/bin.js");
