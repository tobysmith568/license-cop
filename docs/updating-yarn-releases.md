# Updating the committed yarn releases

The e2e suite in `packages/cli-e2e` installs its test projects with the real package managers license-cop scans. For yarn, it runs each version straight from a release file committed in `packages/cli-e2e/yarn-releases` with `node <release> install`, so no yarn needs to be installed on the machine and the exact versions under test are pinned in the repo. The releases are deliberately never updated automatically; bump them by hand using the steps below.

The three release files are:

| Package manager key        | File               | Source package                                                         | File inside the package |
| -------------------------- | ------------------ | ---------------------------------------------------------------------- | ----------------------- |
| `yarn-1`                   | `yarn-1.22.22.cjs` | [`yarn`](https://www.npmjs.com/package/yarn)                           | `lib/cli.js`            |
| `yarn-3-with-node-modules` | `yarn-3.8.7.cjs`   | [`@yarnpkg/cli-dist`](https://www.npmjs.com/package/@yarnpkg/cli-dist) | `bin/yarn.js`           |
| `yarn-4-with-node-modules` | `yarn-4.18.0.cjs`  | [`@yarnpkg/cli-dist`](https://www.npmjs.com/package/@yarnpkg/cli-dist) | `bin/yarn.js`           |

The versions are mapped to their package manager keys in the `yarnReleases` object in `packages/cli-e2e/src/lib/fixtures.ts`.

## Bumping a version

1. Pick the new version. `npm view yarn versions` (for yarn 1) or `npm view @yarnpkg/cli-dist dist-tags` (for yarn 3 and 4) shows what's available.
2. Download and extract the package into a scratch directory, not the repo:

   ```sh
   cd "$(mktemp -d)"
   npm pack yarn@1.22.22                 # yarn 1
   npm pack @yarnpkg/cli-dist@4.18.0     # yarn 3 or 4
   tar xzf *.tgz
   ```

3. Copy the release file out of the package into `packages/cli-e2e/yarn-releases`, named after the new version with a `.cjs` extension:

   ```sh
   cp package/lib/cli.js  <repo>/packages/cli-e2e/yarn-releases/yarn-1.22.23.cjs   # yarn 1
   cp package/bin/yarn.js <repo>/packages/cli-e2e/yarn-releases/yarn-4.19.0.cjs    # yarn 3 or 4
   ```

4. Check the release runs on its own: `node packages/cli-e2e/yarn-releases/yarn-4.19.0.cjs --version` should print the new version.
5. Update the matching entry in `yarnReleases` in `packages/cli-e2e/src/lib/fixtures.ts` to the new file name.
6. Delete the old release file from `packages/cli-e2e/yarn-releases`.
7. Run the suite, ideally without any yarn on your PATH so you know the committed release is what's being used: `bunx turbo run e2e --filter=cli-e2e`.

Prettier and ESLint already ignore `**/yarn-releases/**`, since these are vendored, minified bundles. Don't reformat them.

## Adding another yarn major

A new major means a new package manager key rather than a bump:

1. Add the key to the `PackageManager` type and the `packageManagers` list in `packages/cli-e2e/src/lib/package-managers.ts`.
2. Add its release to `yarnReleases` in `fixtures.ts`.
3. Add the key to the yarn cases of `getInstallCommand` and the `.yarnrc.yml` check in `packages/cli-e2e/src/lib/project.ts`, and to the `resolutions` case in `package-json-builder.ts`. Yarn 2 and later need `nodeLinker: node-modules` because license-cop reads `node_modules`, and `YARN_ENABLE_IMMUTABLE_INSTALLS=false` because yarn enables immutable installs on CI by default and each project is installed fresh.
4. Run the suite. `contract.spec.ts` runs every key in `packageManagers`, so the new one is covered automatically.

## Why not corepack, `yarn set version` or a global yarn?

Each of these reaches the network or depends on whatever is installed on the machine, which is exactly what the local-tarball e2e setup is designed to avoid. Committing the releases keeps the suite offline and deterministic; the cost is a few megabytes in the repo and this manual bump process.

## pnpm

pnpm is pinned differently: one exact-version `devDependency` of `packages/cli-e2e` per major, aliased to its package manager key (`"pnpm-10": "npm:pnpm@10.x.y"`), each run with `node` on its entry point (see `pnpmEntryPoints` in `fixtures.ts`; pnpm 12 ships as a native binary and only keeps a Node entry point at `bin/pnpm.mjs`). To bump one, change its version and run `bun install` and the e2e suite. A new major is a new key in `package-managers.ts`, `fixtures.ts`, `package-json-builder.ts` and `project.ts`. npm is the only package manager that isn't pinned: it's whatever comes with the Node.js version of the CI matrix leg, which is deliberate.

### pnpm 9 is not covered

pnpm 9 fails the contract test: for a dependency whose virtual store directory name is longer than 120 characters (which the `file:` tarball paths are), pnpm 9 shortens it with an MD5 hash, while pnpm 10 and later use a base32 SHA-256 one. `@license-cop/core`'s pnpm engine computes the pnpm 10 name, so it looks for a directory that doesn't exist and throws `Cannot find the file: '.../package.json'`. Registry packages with short names are unaffected; it's only a problem for long ones, such as those with many peer dependency suffixes.
