import { readdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const workspaceRoot = join(__dirname, "../../..");

// Every package manager except npm (which is whatever comes with the Node.js under test) is a
// pinned devDependency of this package, aliased by its package manager key, rather than a global
// install, so the versions under test are the same on every machine. `bun install` puts them in
// this package's own node_modules, and (bun itself aside, see `getBunEntryPoint`) each is run
// straight with `node`.
export const getNodeEntryPoint = (alias: string, entryPoint: string): string =>
  join(__dirname, "../node_modules", alias, entryPoint);

// bun ships a native binary (bin/bun.exe, regardless of OS) rather than a Node script, so it's run
// directly instead of through `node`. Both bun-1-hoisted and bun-1-isolated share this one pinned
// binary; only their bunfig.toml-forced linker differs (see createProject).
export const getBunEntryPoint = (): string => join(__dirname, "../node_modules/bun-1/bin/bun.exe");

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
      `No tarball found in ${tarballsDirectory}. Run \`bunx turbo run pack-fixture\` first, or run the tests through \`bunx turbo run e2e\`.`
    );
  }

  return join(tarballsDirectory, tarball);
};
