import { readdir } from "fs/promises";
import { join } from "path";
import type { PnpmPackageManager } from "./package-managers";

export const workspaceRoot = join(__dirname, "../../../..");

export const cliBinPath = join(workspaceRoot, "packages/cli/dist/bin.js");

// Each yarn is run straight from its committed release with `node`, so no yarn needs to be
// installed on the machine and the exact version under test is pinned in the repo.
const yarnReleases = {
  "yarn-1": "yarn-1.22.22.cjs",
  "yarn-3-with-node-modules": "yarn-3.8.7.cjs",
  "yarn-4-with-node-modules": "yarn-4.18.0.cjs"
} as const;

export const getYarnReleasePath = (packageManager: keyof typeof yarnReleases): string =>
  join(__dirname, "../../yarn-releases", yarnReleases[packageManager]);

// Each pnpm is a pinned devDependency of this package, aliased by package manager key, rather than
// a global install, so the versions under test are the same on every machine. `bun install` puts
// them in this package's own node_modules.
// pnpm 12 ships as a native binary and only keeps a Node entry point at bin/pnpm.mjs (the path
// corepack uses). Earlier majors have a CommonJS one.
const pnpmEntryPoints = {
  "pnpm-10": "bin/pnpm.cjs",
  "pnpm-11": "bin/pnpm.mjs",
  "pnpm-12": "bin/pnpm.mjs"
} as const satisfies Record<PnpmPackageManager, string>;

export const getPnpmBinPath = (packageManager: PnpmPackageManager): string =>
  join(__dirname, "../../node_modules", packageManager, pnpmEntryPoints[packageManager]);

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
