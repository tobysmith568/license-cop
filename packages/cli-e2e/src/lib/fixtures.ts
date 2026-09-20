import { readdir } from "fs/promises";
import { join } from "path";
import type { PinnedPackageManager } from "./package-managers";

export const workspaceRoot = join(__dirname, "../../../..");

export const cliBinPath = join(workspaceRoot, "packages/cli/dist/bin.js");

// Every package manager except npm (which is whatever comes with the Node.js under test) is a
// pinned devDependency of this package, aliased by its package manager key, rather than a global
// install, so the versions under test are the same on every machine. `bun install` puts them in
// this package's own node_modules, and each is run straight with `node`.
const entryPoints = {
  "pnpm-10": "bin/pnpm.cjs",
  // pnpm 12 ships as a native binary and only keeps a Node entry point at bin/pnpm.mjs (the path
  // corepack uses); 11 has both
  "pnpm-11": "bin/pnpm.mjs",
  "pnpm-12": "bin/pnpm.mjs",
  "yarn-1": "bin/yarn.js",
  "yarn-3": "bin/yarn.js",
  "yarn-4": "bin/yarn.js"
} as const satisfies Record<PinnedPackageManager, string>;

export const getPackageManagerEntryPoint = (packageManager: PinnedPackageManager): string =>
  join(__dirname, "../../node_modules", packageManager, entryPoints[packageManager]);

export const fixturePackages = {
  isc: { name: "@license-cop/isc-test-package", directory: "isc-package" },
  mit: { name: "@license-cop/mit-test-package", directory: "mit-package" },
  usesIsc: { name: "@license-cop/uses-isc-test-package", directory: "uses-isc-package" }
} as const;

export type FixturePackage = keyof typeof fixturePackages;

/**
 * The tarball a fixture package was packed into by its `pack-fixture` task. Turbo builds and caches
 * these ahead of the e2e task; running `bun test` directly skips that, hence the explicit error.
 */
export const getTarballPath = async (fixture: FixturePackage): Promise<string> => {
  const { directory } = fixturePackages[fixture];
  const tarballsDirectory = join(workspaceRoot, "packages/e2e", directory, "tarballs");

  const files = await readdir(tarballsDirectory).catch(() => []);
  const tarball = files.find(file => file.endsWith(".tgz"));

  if (!tarball) {
    throw new Error(
      `No tarball found in ${tarballsDirectory}. Run \`bunx turbo run pack-fixture\` first, or run the tests through \`bunx turbo run e2e --filter=cli-e2e\`.`
    );
  }

  return join(tarballsDirectory, tarball);
};
