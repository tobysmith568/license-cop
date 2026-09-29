import { join } from "node:path";
import { directoryExists } from "../utils/directory-exists";
import { bunIsolatedDependencyScanning } from "./bun-isolated";
import { npmDependencyScanning } from "./npm";
import type { DependencyScanner } from "./options";

/**
 * bun has two structurally different install shapes, and which one a project used is only known
 * once it's actually installed (which `assertInstalled` has already confirmed by the time this
 * runs). `node_modules/.bun/` only exists for the isolated linker, so its presence is a robust,
 * structural way to tell the two apart without parsing `bunfig.toml`.
 */
export const bunDependencyScanning: DependencyScanner = async options => {
  const isIsolated = await directoryExists(join(options.workingDirectory, "node_modules", ".bun"));

  // Hoisted bun produces the same flat, npm-compatible node_modules shape npm and yarn do.
  return isIsolated ? bunIsolatedDependencyScanning(options) : npmDependencyScanning(options);
};
