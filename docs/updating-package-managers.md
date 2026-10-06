# Updating the package managers under test

The e2e suite installs its test projects with the real package managers license-cop scans, so the contract tests cover what each one actually writes to disk. Every package manager is a pinned, exact-version `devDependency` of `packages/e2e-fixtures`, aliased to its package manager key:

| Package manager key | `devDependencies` entry         | Entry point      |
| ------------------- | ------------------------------- | ---------------- |
| `bun-1`             | `"npm:bun@1.x.y"`               | `bin/bun.exe`    |
| `npm-10`            | `"npm:npm@10.x.y"`              | `bin/npm-cli.js` |
| `npm-11`            | `"npm:npm@11.x.y"`              | `bin/npm-cli.js` |
| `npm-12`            | `"npm:npm@12.x.y"`              | `bin/npm-cli.js` |
| `pnpm-10`           | `"npm:pnpm@10.x.y"`             | `bin/pnpm.cjs`   |
| `pnpm-11`           | `"npm:pnpm@11.x.y"`             | `bin/pnpm.mjs`   |
| `pnpm-12`           | `"npm:pnpm@12.x.y"`             | `bin/pnpm.mjs`   |
| `yarn-1`            | `"npm:yarn@1.x.y"`              | `bin/yarn.js`    |
| `yarn-3`            | `"npm:@yarnpkg/cli-dist@3.x.y"` | `bin/yarn.js`    |
| `yarn-4`            | `"npm:@yarnpkg/cli-dist@4.x.y"` | `bin/yarn.js`    |

`bun install` puts each in `packages/e2e-fixtures/node_modules/<key>` and its adapter in `fixture-adapters.ts` runs its entry point straight with `node` (bun ships a native binary, so `bun-1` is run directly instead, via `getBunEntryPoint`; the `bun-1-hoisted` and `bun-1-isolated` keys share it and differ only in the linker they force), so nothing needs to be installed on the machine and the exact versions under test are recorded, with an integrity hash, in `bun.lock`. Each adapter is given its entry point through `getNodeEntryPoint` in `packages/e2e-fixtures/src/fixtures.ts`. pnpm 12 ships as a native binary and only keeps a Node entry point at `bin/pnpm.mjs`, which is why it isn't `.cjs` like pnpm 10.

The npm that comes with the Node.js version of a CI matrix leg is deliberately not tested: that matrix exists to exercise license-cop's own runtime, so the npm versions under test are the pinned ones above, whichever Node.js they run on. npm 12 only supports recent Node.js releases (see its `engines`), so a Node.js older than that prints a warning but still runs.

## Bumping a version

Change the version in `packages/e2e-fixtures/package.json` (keeping it exact), run `bun install`, then run the suite with `bunx turbo run e2e --filter=core-e2e`. Renovate does this for you within each major, see `.renovaterc.json`.

## Adding another major

A new major means a new package manager key rather than a bump:

1. Add the key to `PackageManager` and `packageManagers` in `packages/e2e-fixtures/src/package-managers.ts`, and its alias to `packages/e2e-fixtures/package.json`.
2. Add an entry for the key to `fixtureAdapters` in `packages/e2e-fixtures/src/fixture-adapters.ts`, built from the factory for its package manager (`npmAdapter`, `pnpmAdapter`, `yarnClassicAdapter`, `yarnModernAdapter` and so on), passing the key and, where the factory takes one, the entry point of its pinned alias. The adapter holds everything that differs per package manager: how it is run and installed, where it spells overrides, how a workspace member is depended on, where workspace globs live and any config file to write first. Yarn 2 and later need their linker forced (`nodeLinker: node-modules` or `nodeLinker: pnp`, since the ambient default is Plug'n'Play), and `YARN_ENABLE_IMMUTABLE_INSTALLS=false` because yarn enables immutable installs on CI by default and each project is installed fresh; `yarnModernAdapter` already does both, taking the linker as its second argument, which is how `yarn-3-pnp` and `yarn-4-pnp` are variants of `yarn-3` and `yarn-4` that share their pinned alias.
3. If the new package manager differs in a way no existing factory covers, add a factory for it above the registry.
4. Add a `matchDepNames` rule for the new key to `.renovaterc.json`, allowing only its own major.
5. Run the suite. `packages/core-e2e/src/contract.spec.ts` runs every key in `packageManagers`, so the new one is covered automatically.

## pnpm 9 is not covered

pnpm 9 fails the contract test: for a dependency whose virtual store directory name is longer than 120 characters (which the `file:` tarball paths are), pnpm 9 shortens it with an MD5 hash, while pnpm 10 and later use a base32 SHA-256 one. `@license-cop/core`'s pnpm engine computes the pnpm 10 name, so it looks for a directory that doesn't exist and throws `Cannot find the file: '.../package.json'`. Registry packages with short names are unaffected; it's only a problem for long ones, such as those with many peer dependency suffixes.
