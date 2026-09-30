import { describe, expect, it } from "bun:test";
import { dirname } from "path";
import { fileURLToPath } from "url";
import {
  getBunEntryPoint,
  getPackageManagerEntryPoint,
  type NodeEntryPointPackageManager
} from "./fixtures";
import { packageManagers } from "./package-managers";
import { runProcess } from "./run-process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// bun-1-hoisted and bun-1-isolated share the one pinned bun binary (only their forced linker
// differs, see project.ts), and it's run directly rather than through `node` (see
// getBunEntryPoint), so it's checked once, separately from the rest below.
const nodeRunPackageManagers = packageManagers.filter(
  (packageManager): packageManager is NodeEntryPointPackageManager =>
    packageManager !== "npm" &&
    packageManager !== "bun-1-hoisted" &&
    packageManager !== "bun-1-isolated"
);

// Each alias is named after the major version it's pinned to (see .renovaterc.json), so a Renovate
// config that stops pinning one, or a manual bump past its major, would go unnoticed until an e2e
// project happened to exercise it. This checks the promise directly against the binary already in
// node_modules, skipping the project install (temp dir, lockfile, real dependency resolution) that
// createProject() does for the full e2e suite.
describe.each(nodeRunPackageManagers)("%s", packageManager => {
  it("reports the major version its alias promises", async () => {
    const [, expectedMajor] = packageManager.split("-");

    const { exitCode, output } = await runProcess(
      "node",
      [getPackageManagerEntryPoint(packageManager), "--version"],
      { cwd: __dirname }
    );

    expect(exitCode).toBe(0);
    expect(output.trim()).toMatch(new RegExp(`^${expectedMajor}\\.`));
  });
});

describe("bun-1", () => {
  it("reports the major version its alias promises", async () => {
    const { exitCode, output } = await runProcess(getBunEntryPoint(), ["--version"], {
      cwd: __dirname
    });

    expect(exitCode).toBe(0);
    expect(output.trim()).toMatch(/^1\./);
  });
});
