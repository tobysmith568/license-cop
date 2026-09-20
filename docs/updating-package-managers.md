# Updating the package managers under test

The e2e suite in `packages/cli-e2e` installs its test projects with the real package managers license-cop scans, so the contract tests cover what each one actually writes to disk. Every package manager except npm is a pinned, exact-version `devDependency` of `packages/cli-e2e`, aliased to its package manager key:

| Package manager key | `devDependencies` entry         | Entry point    |
| ------------------- | ------------------------------- | -------------- |
| `pnpm-10`           | `"npm:pnpm@10.x.y"`             | `bin/pnpm.cjs` |
| `pnpm-11`           | `"npm:pnpm@11.x.y"`             | `bin/pnpm.mjs` |
| `pnpm-12`           | `"npm:pnpm@12.x.y"`             | `bin/pnpm.mjs` |
| `yarn-1`            | `"npm:yarn@1.x.y"`              | `bin/yarn.js`  |
| `yarn-3`            | `"npm:@yarnpkg/cli-dist@3.x.y"` | `bin/yarn.js`  |
| `yarn-4`            | `"npm:@yarnpkg/cli-dist@4.x.y"` | `bin/yarn.js`  |

`bun install` puts each in `packages/cli-e2e/node_modules/<key>` and `project.ts` runs its entry point straight with `node`, so nothing needs to be installed on the machine and the exact versions under test are recorded, with an integrity hash, in `bun.lock`. The entry points are mapped in `entryPoints` in `packages/cli-e2e/src/lib/fixtures.ts`. pnpm 12 ships as a native binary and only keeps a Node entry point at `bin/pnpm.mjs`, which is why it isn't `.cjs` like pnpm 10.

npm is the only one that isn't pinned: it's whatever comes with the Node.js version of the CI matrix leg, which is deliberate.

## Bumping a version

Change the version in `packages/cli-e2e/package.json` (keeping it exact), run `bun install`, then run the suite with `bunx turbo run e2e --filter=cli-e2e`. Renovate does this for you within each major, see `.renovaterc.json`.

## Adding another major

A new major means a new package manager key rather than a bump:

1. Add the key to `PackageManager` and `packageManagers` in `packages/cli-e2e/src/lib/package-managers.ts`, and its alias to `packages/cli-e2e/package.json`.
2. Add its entry point to `entryPoints` in `fixtures.ts`.
3. Add the key to `getInstallCommand` in `project.ts` and to the `overrides` case in `package-json-builder.ts`. Yarn 2 and later need `nodeLinker: node-modules` (and so a check in `createProject`) because license-cop reads `node_modules`, and `YARN_ENABLE_IMMUTABLE_INSTALLS=false` because yarn enables immutable installs on CI by default and each project is installed fresh.
4. Add a `matchDepNames` rule for the new key to `.renovaterc.json`, allowing only its own major.
5. Run the suite. `contract.spec.ts` runs every key in `packageManagers`, so the new one is covered automatically.

## pnpm 9 is not covered

pnpm 9 fails the contract test: for a dependency whose virtual store directory name is longer than 120 characters (which the `file:` tarball paths are), pnpm 9 shortens it with an MD5 hash, while pnpm 10 and later use a base32 SHA-256 one. `@license-cop/core`'s pnpm engine computes the pnpm 10 name, so it looks for a directory that doesn't exist and throws `Cannot find the file: '.../package.json'`. Registry packages with short names are unaffected; it's only a problem for long ones, such as those with many peer dependency suffixes.
