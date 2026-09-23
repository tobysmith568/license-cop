import { join } from "path";

const workspaceRoot = join(__dirname, "../../../..");

export const cliBinPath = join(workspaceRoot, "packages/cli/dist/bin.js");
