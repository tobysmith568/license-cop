# license-cop migration plan

This plan adds dependency-scanning support for bun, consolidates how a package manager is dispatched
to now that bun has shown the current shape straining under it, broadens npm's own fixture coverage
to match pnpm/yarn's thoroughness, then adds support for Yarn Plug'n'Play. Infrastructure
modernization (package manager, task runner, linter, test runner, browser-test runner, CI) and the
CLI's internal architecture and public package boundary are complete, as are bun support (Part 3) and the dispatch consolidation (Part 4). See "Suggested order" at the end for the concrete sequencing and dependencies between the remaining steps.

## Guiding principles

- **license-cop's whole job is understanding other package managers.** Keep npm, pnpm, yarn
  classic and yarn modern dependency-scanning support (and add bun, then Yarn PnP) regardless of
  what the workspace itself is built with.
- **One big-bang branch per part, not one PR per item.** Part 3 (bun support), Part 4 (consolidating
  package-manager dispatch), Part 5 (broadening npm fixture coverage) and Part 6 (Yarn Plug'n'Play
  support) each land as a single branch merged in one go, rather than each checklist item going out
  as its own PR. Within a branch, land the checklist items as separate commits in the order listed
  so the history stays legible and bisectable, but the repo only needs to be green again at
  branch-merge time, not after every individual commit.

## Part 3 — bun support (landed)

Added dependency-scanning support for both of bun's install shapes: **hoisted** (npm-compatible
flat `node_modules`, dispatches to the existing `npmDependencyScanning` via arborist, no new engine
needed) and **isolated** (`[install] linker = "isolated"`, bun's workspace default, modeled on
pnpm's virtual store). `PackageManager` stays a single `"bun"` value; which linker an install used is
detected at scan time by checking for `node_modules/.bun/` on disk (originally inside `bun`'s entry in
`license-cop.ts`'s `scanners` record; Part 4 moved it to `BunPackageManager.detectInstallShape`).

The isolated engine (now `lib/dependency-scanning/bun/bun-isolated-engine.ts`) ended up resolving every dependency
by following bun's own `node_modules` symlinks via `realpath`, not by parsing `bun.lock` for tree
shape as originally planned: `bun.lock`'s `packages` map doesn't reliably name a resolution's
on-disk store folder (a `file:` dependency's folder is a hash, not `name@version`). `bun.lock` is
now read only for each workspace's declared dependencies and member paths.

Contract-test coverage added as `"bun-1-hoisted"` and `"bun-1-isolated"` in
`packages/e2e-fixtures`'s `packageManagers` list, each forcing its linker via a written
`bunfig.toml` rather than relying on bun's ambient default. Needed `"bun"` added to root
`trustedDependencies` (otherwise bun skips its postinstall and leaves an error stub instead of the
real binary) and a direct-execution entry point, since bun ships a native binary
(`bin/bun.exe`) rather than a `.js` file.

CI's `local-licenses` job is re-enabled (it runs this branch's own build against this repo's own
isolated-linker workspace); `published-licenses` stays disabled since it runs the
currently-published npm package, which won't have bun support until a release ships after this
branch merges.

## Part 4 — Consolidate package-manager dispatch (landed)

A structural cleanup prompted by what building bun exposed: `@license-cop/core` spread each package manager's per-identity concerns across several independent structures (`license-cop.ts`'s `scanners` record, `assert-installed.ts`'s `installCommands` record, and a one-off `if (packageManager === "yarn")` PnP check outside both), and `packages/e2e-fixtures` had three separate exhaustive switches over the same `PackageManager` type. Bun's `bun.ts` was a hand-written dispatcher for "one identity, several install shapes, detected at scan time", the same shape Yarn PnP (Part 6) needs. It was done before Part 5 so that each new npm variant is one adapter entry instead of an edit to three files.

**The domain has two axes.** A package manager's **identity** (npm, yarn, pnpm, bun) decides its install command and how its install shape is detected. Its **install shape** (`InstallShape` in `lib/install-shape.ts`: `"node-modules"`, `"pnpm-store"`, `"bun-isolated"`) decides which engine can walk it. npm, yarn and hoisted bun all share `"node-modules"`.

Two prototypes were built against the real code and compared on real installs (9 package managers, single package and workspace, all four dev/prod modes, plus yarn 3 and 4 PnP): a functional one (data-driven adapter records and an engine factory) and an object-oriented one. Both were identical to the old behaviour. The object-oriented design was chosen for `@license-cop/core`, and the functional one for `packages/e2e-fixtures`, on readability, extensibility and testability. The reasoning is worth keeping: core has real I/O boundaries (the disk, arborist, pnpm's library) where constructor injection pays for itself, while the fixture side is pure data about package managers that is only ever exercised against real installs, so classes there were the same data with more ceremony.

**What landed in `@license-cop/core`**

- `composition-root.ts` is the only place anything is constructed. `compose(logger, gateways)` builds the object graph; `createLicenseChecker(onVerbose, gateways)` is what the public `checkLicenses` calls, so the public API is unchanged. `Gateways` (`fileSystem`, `treeLoader`, `pnpmProjectLocator`, `pnpmHierarchyReader`) are the edges a test can replace.
- `LicenseChecker.check` is the one place the steps of a check are ordered: normalize options, detect the package manager, detect the install shape, verify the project is installed, pick an engine, scan.
- `PackageManager` is abstract (name, install command, lock files, `detectInstallShape()`) with `NpmPackageManager`, `YarnPackageManager`, `PnpmPackageManager` and `BunPackageManager`. `PackageManagerDetector` replaces `getPackageManager`. Every package manager implements `detectInstallShape`, with single-shape ones returning a constant, so `LicenseChecker` has no branching. Bun's `.bun/` check lives in `BunPackageManager`, and `bun.ts` is gone.
- **There is no `assertPreconditions` slot** (this changed from the original plan). Yarn's PnP refusal is really a shape-detection outcome ("this shape isn't supported yet"), so `YarnPackageManager.detectInstallShape` throws `UnsupportedProjectError` for it, and shape detection runs before the installed check (which keeps reporting PnP rather than "no node_modules"). No other precondition exists or is planned.
- Engines: `WalkingDependencyScanningEngine` is a template method holding the shared sequence (decide what is in scope, walk, classify), and `NodeModulesEngine`, `PnpmStoreEngine` and `BunIsolatedEngine` each supply only `walk`. `EngineRegistry` maps `InstallShape` to an engine and is typed as a `Record`, so a new shape fails to compile until it is mapped. The walks stay bespoke: apart from entry and exit they share nothing worth extracting.
- `Inclusion` (`toInclusion`, `isIncluded`) is the one place the dev/prod/optional decision is made. The three engines used to formulate it three ways (per node, as pnpm library options, as which dependency maps bun walks). Optional dependencies count as production ones.
- Classes sit at boundaries and orchestration only (`FileSystem`, the JSON file readers, the tree and pnpm gateways, `BunStoreResolver`, the engines, `InstallationVerifier`, `OptionsNormalizer`, the classifier). Pure logic stays as plain functions: the SPDX tokenizer, parser and issue calculator, `joinStringArray`, `json5Parse` and `isAllowedPackage`. `classify-dependencies.ts` and `NormalizedNode` were out of scope and keep their role as the shared interchange shape; the classifier is now a class only because it holds the logger.
- Testing: `InMemoryFileSystem` and `createMemoryDir()` (the in-memory counterpart of `createTempDir()`, symlinks included), `FakeTreeLoader` and the fake pnpm gateways let every spec except `file-system.spec.ts` run without touching the disk, and no core spec uses `mock.module` any more. The cost is that arborist's and pnpm's real libraries are exercised only by the real-install contract tests (`core-e2e`, `cli-e2e`), not by any unit spec.

**What landed in `packages/e2e-fixtures`**

- One `Record<PackageManager, FixtureAdapter>` in `fixture-adapters.ts`, built from arrow-const factories (`npmAdapter`, `pnpmAdapter`, `yarnClassicAdapter`, `yarnModernAdapter`, `bunAdapter`) that sit above it because the registry is built eagerly. An adapter holds the invocation, install args and env, how overrides are spelled, the workspace member specifier (`"*"` or `"workspace:*"`), where workspace globs live, and an optional config writer (yarn 2+'s `.yarnrc.yml`, bun's `bunfig.toml`).
- It replaces `project.ts`'s `getInstallCommand` switch, `package-json-builder.ts`'s overrides switch and `usesWorkspaceProtocol` check, `fixtures.ts`'s `entryPoints` map and the `startsWith("pnpm")` and yarn and bun config branches in `createProject`. `package-managers.spec.ts` is now one `describe.each` over the pinned managers. `PinnedPackageManager` and `NodeEntryPointPackageManager` are gone.

## Part 5 — Broaden npm fixture coverage

A separate branch, after Part 4 merges and before Part 6. Not part of bun support itself, it's a
standalone improvement: today `"npm"` in `packages/e2e-fixtures/src/package-managers.ts` means
"whatever ships with the Node.js under test," the only package manager tested that way, unlike
pnpm (`pnpm-10`/`11`/`12`) and yarn (`yarn-1`/`3`/`4`), which are each pinned to specific majors.
npm should get the same treatment. Sequenced after Part 4 so each new npm variant is added to the
consolidated adapter registry rather than the old scattered switches Part 4 replaced.

- [ ] Decide which npm majors matter (mirroring how pnpm picked 10/11/12 and yarn picked 1/3/4), and
      whether the bare `"npm"` entry ("whatever ships with the Node.js under test") stays alongside
      the pinned ones or is replaced by them.
- [ ] Pin the chosen npm majors as npm-aliased devDependencies (`"npm-X": "npm:npm@^X"`) in
      `packages/e2e-fixtures/package.json`, with a matching `fixtureAdapters` entry in `fixture-adapters.ts`
      (an `npmAdapter` that takes the key and entry point, since the bare `"npm"` entry takes neither today).
- [ ] Check that nothing is still keyed on the literal string `"npm"`. After Part 4 the facts that used to be (`memberSpecifier`, where overrides go, the install invocation) are fields of the adapter, so a pinned npm variant only needs its own adapter entry; the remaining places to look are specs and `packageManagers` consumers that special-case `"npm"` as unpinned (for example `package-managers.spec.ts`'s filter).

## Part 6 — Yarn Plug'n'Play support

A seventh branch (after Parts 3, 4 and 5 merge): it builds on the test pyramid from 2.5 and on
Part 4 having already settled how a package manager with more than one install shape is added to
`@license-cop/core` and `packages/e2e-fixtures` (bun was the first such addition, worked out by
hand in Part 3 and generalized in Part 4 as `InstallShape`, `PackageManager.detectInstallShape` and the engine registry; this is the second, and the first one that isn't
arborist- or pnpm-library-readable).

**Where things stand today (added during the final pass on 2.x).** Yarn 2+ defaults to Plug'n'Play, which installs no `node_modules` at all — just a `.pnp.cjs` resolution map and zipped packages in `.yarn/cache`. license-cop's npm engine reads `node_modules` through arborist, so before the final pass a PnP project scanned as an empty tree and printed "Done! No issues found" with exit code 0, even with a forbidden license in the dependency graph (confirmed with a real yarn 4 install). That silent false negative is fixed for now by detect-and-refuse: `YarnPackageManager.detectInstallShape` in `@license-cop/core` (using `PlugAndPlayDetector`) throws an `UnsupportedProjectError` when the project resolves to yarn and has a `.pnp.cjs`/`.pnp.js`, telling the user to set `nodeLinker: node-modules`. `packages/cli-e2e/src/lib/plug-and-play.spec.ts` covers it with real yarn 3 and yarn 4 PnP installs (via `createProject`'s `linker: "pnp"` option). This part replaces the refusal with real support.

- [ ] **Decide how to read a PnP install.** This needs a spike before anything is built, because PnP has no `node_modules` for arborist to load. Candidates: load the project's own `.pnp.cjs` (it exports a runtime API — `getAllLocators`, `getPackageInformation`, `resolveToUnqualified` — that gives every package's location and its dependency map) and walk it; or shell out to the project's own yarn (`yarn info --all --recursive --json`) and normalize its output. The former needs no yarn on the machine but has to read `package.json` out of `.yarn/cache/*.zip` (`@yarnpkg/fslib` + `@yarnpkg/libzip`, or unzipping ourselves) and out of `.yarn/unplugged`; the latter depends on a working yarn and on its JSON format staying stable across majors. Pick one against the real fixtures, the same way Part 3's bun engine questions are settled by real installs rather than assumptions.
- [ ] A new engine (for example `lib/dependency-scanning/yarn-pnp/yarn-pnp-engine.ts`, or whatever the spike settles on) extending `WalkingDependencyScanningEngine`: supply only `walk`, turning the PnP data into `NormalizedNode`s, so it stays a "read my package manager's native shape" module with no classification logic of its own. Put the PnP data source behind a gateway interface, like `InstalledTreeLoader`, so the engine can be unit tested without a real `.pnp.cjs`. PnP data doesn't flag dev vs prod the way arborist's `node.dev` does, so the dev/prod split has to be derived by walking from the workspace root's own `dependencies` and `devDependencies` using the `Inclusion` the walk is given, the same shape of caveat the npm and pnpm engines had; pin the behaviour with a test first.
- [ ] Add `"yarn-pnp"` to `InstallShape`; `tsc` then demands an entry in `EngineRegistry`, so a half-added shape can't compile. Change `YarnPackageManager.detectInstallShape` to return it instead of throwing, and register the new engine in `composition-root.ts`. Then delete the refusal, and `UnsupportedProjectError` if nothing else uses it by then; the error is the interim behaviour, not part of the design.
- [ ] Make `InstallationVerifier` shape-aware. It currently requires a `node_modules` directory, which PnP never has, so it would wrongly throw `NotInstalledError` on a supported PnP project. `LicenseChecker` already detects the shape before verifying, so pass it in and let each shape say what "installed" means (for PnP, a `.pnp.cjs`).
- [ ] Flip `packages/cli-e2e/src/lib/plug-and-play.spec.ts` from "is refused" to the same contract assertions `contract.spec.ts` makes (names, versions, licenses, dev/prod split for the default / include / only modes), for yarn 3 and yarn 4. The `linker: "pnp"` option on `createProject` and the yarn 3/4 aliases are already in place (a PnP variant is `yarnModernAdapter` plus a linker), so this is a test change rather than new harness work. Fold it into `contract.spec.ts`'s package-manager list as `"yarn-3-pnp"`/`"yarn-4-pnp"`-style entries rather than a second spec file, the same way Part 3 folded bun's isolated linker in rather than giving it its own file.
- [ ] Cover the PnP-specific shapes the contract fixture doesn't reach: workspaces, `npm:` aliases, `patch:` and `portal:`/`link:` protocols, packages in `.yarn/unplugged`, and zero-install repos (`.yarn/cache` committed, no install step). Decide which of these are in scope for a first version and say so in the docs.
- [ ] Docs: remove the "set `nodeLinker: node-modules`" guidance from the README, the copy in `packages/cli`, and `apps/website/src/pages/docs.md`, and document Plug'n'Play as supported.
- [ ] Add a Yarn PnP leg to the CI `e2e` matrix only if the contract-test approach above doesn't already cover it (it should — the matrix legs vary OS and Node, not package manager).

## Suggested order

**Part 3 (a branch):**

1. **Part 3** (bun support, both linkers) — on its own, once `@license-cop/core`'s package-manager
   detection, scanning modules, and the 2.4/2.5 test pyramid have already settled from Part 2.

**Part 4 (a branch, after Part 3 merges; landed):**

2. **Part 4** (consolidate package-manager dispatch) — right after bun, while what it exposed is
   still fresh, and before Part 5 touches the same switch statements this part replaces. Landing the
   consolidation first means Part 5 adds each new npm variant as one adapter object instead of
   editing the old scattered shape and needing a second migration later.

**Part 5 (a branch, after Part 4 merges):**

3. **Part 5** (broaden npm fixture coverage) — after the dispatch consolidation, so each new npm
   variant is added to the settled adapter shape; before Yarn PnP, so PnP's own fixture work lands on
   a settled package-manager list rather than one still being broadened underneath it.

**Part 6 (a branch, after Part 5 merges):**

4. **Part 6** (Yarn Plug'n'Play support) — last, because it builds on the package-manager-addition
   shape Part 4 generalized from what Part 3 worked out by hand for bun (`InstallShape` with its engine registry, each package manager's `detectInstallShape`, and the shared engine template), and
   because PnP is the first package manager that needs its own way of reading an install rather than
   reusing arborist or the pnpm hierarchy library.
