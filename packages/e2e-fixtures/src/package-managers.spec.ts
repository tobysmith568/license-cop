import { describe, expect, it } from "bun:test";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { fixtureAdapters } from "./fixture-adapters";
import { packageManagers } from "./package-managers";
import { runProcess } from "./run-process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Each alias is named after the major version it's pinned to (see .renovaterc.json), so a Renovate
// config that stops pinning one, or a manual bump past its major, would go unnoticed until an e2e
// project happened to exercise it. This checks the promise directly against the binary already in
// node_modules, skipping the project install (temp dir, lockfile, real dependency resolution) that
// createProject() does for the full e2e suite.
describe.each(packageManagers)("%s", packageManager => {
  it("reports the major version its alias promises", async () => {
    const [, expectedMajor] = packageManager.split("-");
    const { command, args } = fixtureAdapters[packageManager].invocation;

    const { exitCode, output } = await runProcess(command, [...args, "--version"], {
      cwd: __dirname
    });

    expect(exitCode).toBe(0);
    // Matched per line: a package manager may warn on stderr first (npm does when the Node.js
    // running it is older than its supported range), and runProcess merges that into the output
    expect(output).toMatch(new RegExp(`^${expectedMajor}\\.\\d+\\.\\d+`, "m"));
  });
});
