import { readdir } from "fs/promises";
import { join } from "path";

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
