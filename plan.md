# license-cop migration plan

This plan adds dependency-scanning support for bun, broadens npm's own fixture coverage to match
pnpm/yarn's thoroughness, then adds support for Yarn Plug'n'Play. Infrastructure modernization
(package manager, task runner, linter, test runner, browser-test runner, CI) and the CLI's internal
architecture and public package boundary are complete. See "Suggested order" at the end for the
concrete sequencing and dependencies between the remaining steps.

## Guiding principles

- **license-cop's whole job is understanding other package managers.** Keep npm, pnpm, yarn
  classic and yarn modern dependency-scanning support (and add bun, then Yarn PnP) regardless of
  what the workspace itself is built with.
- **One big-bang branch per part, not one PR per item.** Part 3 (bun support), Part 4 (broadening
  npm fixture coverage) and Part 5 (Yarn Plug'n'Play support) each land as a single branch merged in
  one go, rather than each checklist item going out as its own PR. Within a branch, land the
  checklist items as separate commits in the order listed so the history stays legible and
  bisectable, but the repo only needs to be green again at branch-merge time, not after every
  individual commit.

## Part 3 — bun support

A separate big-bang branch from Part 2: it depends on Part 2 having already relocated
`get-package-manager.ts` and the dependency-scanning modules into `@license-cop/core`, and — more
importantly now — on 2.4/2.5's test pyramid already being in place. Under the old fixture-matrix
shape, adding bun meant a full ~10-directory `e2e/bun/**` scenario set; under the pyramid, it means
one more entry (or two, see below) in the contract test's package-manager list, because 2.4's
classifier already covers scenarios package-manager-agnostically.

**Both of bun's linker modes are in scope from day one**, not just the default. Bun has two
structurally different install shapes: **hoisted** (npm-compatible flat `node_modules`, bun's
historical default for a single-package project) and **isolated** (`[install] linker = "isolated"`
in `bunfig.toml`, or the default for a *workspace* project since lockfile `configVersion: 1`,
explicitly modeled on pnpm: root `node_modules` holds only symlinks into a central store at
`node_modules/.bun/<name>@<version>/...`). This repo's own `bunfig.toml` already sets
`linker = "isolated"`, so isolated support isn't optional scope, it's required for `local-licenses`
(see CI, below) to ever pass against this repo's own tree.

- [ ] `@license-cop/core`'s `lib/dependency/get-package-manager.ts`: add `"bun"` to the
      `PackageManager` union; `tryResolveFromPackageManager` gains a
      `packageManager.startsWith("bun")` branch; `resolveFromLockFileDiscovery` checks for
      `bun.lock` (text) and `bun.lockb` (legacy binary format), slotted in after the existing
      `yarn.lock`/`pnpm-lock.yaml` checks and before the npm default.
- [ ] **`bun.lockb` (legacy binary lockfile): support it only if it comes for free.** There's no
      official library for reading it (only a stale, two-years-unmaintained community package), so
      don't hand-roll a binary-format parser for it. If the hoisted engine ends up needing no
      lockfile-content parsing at all (pure `node_modules` walking), or if `bun.lock` (text, which is
      plain JSON-ish) turns out easy enough to parse ourselves, extend that same support to
      `bun.lockb` for free. Otherwise, leave it unsupported. (`bun.lockb` predates isolated linker
      entirely, so a `bun.lockb`-based project is unlikely to ever need the isolated engine anyway.)
- [ ] **Engine dispatch, both linkers.** `PackageManager` stays a single `"bun"` value (linker isn't
      a package-manager identity, the same way yarn PnP vs. node-modules doesn't get its own
      `PackageManager` value either). Which linker an already-installed project used is detected at
      *scan* time, inside a single `bun` entry in `lib/license-cop.ts`'s `scanners` record, once
      `assertInstalled` has already confirmed `node_modules` exists: check for `node_modules/.bun/`
      on disk (robust, no config-parsing needed, and only meaningful post-install anyway) and
      dispatch internally to whichever engine matches. This keeps the existing "exhaustive `Record`,
      can't silently fall through" guarantee on `scanners` intact.
      **Spike before writing engine code:** (1) hoisted — is a real `bun install`-produced
      `node_modules` arborist-readable (names/versions/`packageJson` at every depth, `node.dev`
      reflecting dev/prod, `node.isWorkspace` behavior)? (2) isolated — is `bun.lock` alone (it
      contains the full resolved graph, including per-workspace `dependencies`/`devDependencies`)
      enough to build the tree, the way `pnpm.ts` reads `readWantedLockfile` rather than walking
      `node_modules` structurally, touching disk only to read each resolved package's own
      `package.json`? If arborist reads hoisted correctly: `bun: npmDependencyScanning` needs no new
      engine file for that path. Isolated will very likely need a new
      `lib/dependency-scanning/bun-isolated.ts` (or whatever the lockfile spike settles on, possibly
      sharing code with `pnpm.ts` if the shapes are similar enough), since isolated's structure is
      exactly the phantom-dependency-preventing shape arborist can't already walk for pnpm.
- [ ] Add bun to the contract test, both linkers: extend `packages/e2e-fixtures`'s `PackageManager`
      type/`packageManagers` list (`package-managers.ts`) with `"bun-1-hoisted"` and
      `"bun-1-isolated"` (major-version pin only, not full patch granularity — `bun` is published to
      the npm registry with `bun`/`bunx` bins, so `"bun-1": "npm:bun@^1"` slots into
      `e2e-fixtures/package.json`'s devDependencies next to `pnpm-10`/`yarn-1`, with a matching
      `entryPoints` line in `fixtures.ts`). `createProject` must write its own `bunfig.toml` forcing
      the matching linker for *both* entries explicitly, never relying on bun's own default (which
      differs between a single-package project and a workspace one, so leaving it implicit would mean
      `contract.spec.ts`'s single-package fixtures and `workspaces.spec.ts`'s workspace fixtures
      silently exercised different engines for the same nominal entry). Because both spec files
      already `describe.each(packageManagers)`, this gives full linker × project-shape coverage with
      no new test-writing. `getInstallCommand` (`project.ts`) needs a `"bun-1-*"` case, modeled on the
      pnpm/yarn cases (pinned entry point via `node`) rather than npm's (whatever's on PATH), since
      bun is pinned here.
      Check that bun's `overrides`/`resolutions` accept a `file:` tarball for the transitive `isc`
      redirect the way npm, pnpm and yarn do (spike it first, as was done for the others). If it
      doesn't: decide then, with the real trade-offs in view, whether `PackageJsonBuilder`'s
      `overriding` needs a bespoke bun workaround or whether it's acceptable to document the gap and
      drop that one contract permutation for bun.
- [ ] CI: re-enable `local-licenses` (it runs this branch's own build,
      `node ./packages/cli/dist/bin.js`) once bun support actually works end to end against this
      repo's own isolated-linker install. **Leave `published-licenses` disabled** — it runs
      `bunx license-cop`, which resolves the *currently-published* npm package, not this branch's
      code, so it can't pass until a release containing bun support has actually shipped; flip it in
      a follow-up PR at that point, restoring its original `if: inputs.is_release == false` condition.
      No change needed to the `e2e` job's OS/Node matrix itself, it varies OS/Node, not package
      manager, and `packageManagers` already carries the per-package-manager coverage.

## Part 4 — Broaden npm fixture coverage

A separate branch, after Part 3 merges and before Part 5. Not part of bun support itself, it's a
standalone improvement: today `"npm"` in `packages/e2e-fixtures/src/package-managers.ts` means
"whatever ships with the Node.js under test," the only package manager tested that way, unlike
pnpm (`pnpm-10`/`11`/`12`) and yarn (`yarn-1`/`3`/`4`), which are each pinned to specific majors.
npm should get the same treatment. Sequenced as its own branch rather than folded into Part 3
because it touches the same shared switch statements Part 3 also touches (`toMemberSpecifiers`'s
workspace-protocol check and the `overrides`/`resolutions` switch, both in
`package-json-builder.ts`, both currently keyed on exact-match `"npm"`), so doing them in the same
branch would just create needless in-flight conflicts.

- [ ] Decide which npm majors matter (mirroring how pnpm picked 10/11/12 and yarn picked 1/3/4), and
      whether the bare `"npm"` entry ("whatever ships with the Node.js under test") stays alongside
      the pinned ones or is replaced by them.
- [ ] Pin the chosen npm majors as npm-aliased devDependencies (`"npm-X": "npm:npm@^X"`) in
      `packages/e2e-fixtures/package.json`, with matching `entryPoints` lines in `fixtures.ts`.
- [ ] Update every place currently keyed on the literal string `"npm"` to treat every pinned npm
      variant the same way: `toMemberSpecifiers`'s `usesWorkspaceProtocol` check and the `overrides`
      vs `resolutions` switch, both in `package-json-builder.ts`.

## Part 5 — Yarn Plug'n'Play support

A sixth branch (after Parts 3 and 4 merge): it builds on the test pyramid from 2.5 and on Part 3
having already settled how a new package manager is added to `@license-cop/core` and
`packages/e2e-fixtures` (bun was the first addition under the pyramid; this is the second, and the
first one that isn't arborist-readable).

**Where things stand today (added during the final pass on 2.x).** Yarn 2+ defaults to Plug'n'Play, which installs no `node_modules` at all — just a `.pnp.cjs` resolution map and zipped packages in `.yarn/cache`. license-cop's npm engine reads `node_modules` through arborist, so before the final pass a PnP project scanned as an empty tree and printed "Done! No issues found" with exit code 0, even with a forbidden license in the dependency graph (confirmed with a real yarn 4 install). That silent false negative is fixed for now by detect-and-refuse: `assertNotPlugAndPlay` in `@license-cop/core` throws an `UnsupportedProjectError` when the project resolves to yarn and has a `.pnp.cjs`/`.pnp.js`, telling the user to set `nodeLinker: node-modules`. `packages/cli-e2e/src/lib/plug-and-play.spec.ts` covers it with real yarn 3 and yarn 4 PnP installs (via `createProject`'s `linker: "pnp"` option). This part replaces the refusal with real support.

- [ ] **Decide how to read a PnP install.** This needs a spike before anything is built, because PnP has no `node_modules` for arborist to load. Candidates: load the project's own `.pnp.cjs` (it exports a runtime API — `getAllLocators`, `getPackageInformation`, `resolveToUnqualified` — that gives every package's location and its dependency map) and walk it; or shell out to the project's own yarn (`yarn info --all --recursive --json`) and normalize its output. The former needs no yarn on the machine but has to read `package.json` out of `.yarn/cache/*.zip` (`@yarnpkg/fslib` + `@yarnpkg/libzip`, or unzipping ourselves) and out of `.yarn/unplugged`; the latter depends on a working yarn and on its JSON format staying stable across majors. Pick one against the real fixtures, the same way Part 3's bun engine questions are settled by real installs rather than assumptions.
- [ ] `lib/dependency-scanning/yarn-pnp.ts` (or whatever the spike settles on): walk the PnP data into `NormalizedNode`s and hand them to `classifyDependencies` (2.4), so it stays a "read my package manager's native shape" module with no classification logic of its own. PnP data doesn't flag dev vs prod the way arborist's `node.dev` does, so the dev/prod split has to be derived by walking from the workspace root's own `dependencies` and `devDependencies`, the same shape of caveat 2.4 called out between the npm and pnpm engines — pin the behaviour with a test first.
- [ ] `lib/dependency/get-package-manager.ts` / `lib/license-cop.ts`: distinguish yarn-with-PnP from yarn-with-`node-modules` (today both are `"yarn"` and take the npm engine), and dispatch the former to the new engine, the same "single package-manager identity, linker detected and dispatched at scan time" shape Part 3 established for bun. Then delete `assertNotPlugAndPlay` and `UnsupportedProjectError` if nothing else uses them by then — the error is the interim behaviour, not part of the design.
- [ ] Flip `packages/cli-e2e/src/lib/plug-and-play.spec.ts` from "is refused" to the same contract assertions `contract.spec.ts` makes (names, versions, licenses, dev/prod split for the default / include / only modes), for yarn 3 and yarn 4. The `linker: "pnp"` option on `createProject` and the yarn 3/4 aliases are already in place, so this is a test change rather than new harness work. Fold it into `contract.spec.ts`'s package-manager list as `"yarn-3-pnp"`/`"yarn-4-pnp"`-style entries rather than a second spec file, the same way Part 3 folded bun's isolated linker in rather than giving it its own file.
- [ ] Cover the PnP-specific shapes the contract fixture doesn't reach: workspaces, `npm:` aliases, `patch:` and `portal:`/`link:` protocols, packages in `.yarn/unplugged`, and zero-install repos (`.yarn/cache` committed, no install step). Decide which of these are in scope for a first version and say so in the docs.
- [ ] Docs: remove the "set `nodeLinker: node-modules`" guidance from the README, the copy in `packages/cli`, and `apps/website/src/pages/docs.md`, and document Plug'n'Play as supported.
- [ ] Add a Yarn PnP leg to the CI `e2e` matrix only if the contract-test approach above doesn't already cover it (it should — the matrix legs vary OS and Node, not package manager).

## Suggested order

**Part 3 (a branch):**

1. **Part 3** (bun support, both linkers) — on its own, once `@license-cop/core`'s package-manager
   detection, scanning modules, and the 2.4/2.5 test pyramid have already settled from Part 2.

**Part 4 (a branch, after Part 3 merges):**

2. **Part 4** (broaden npm fixture coverage) — after bun, so the two efforts don't collide in the
   same shared fixture-plumbing files; before Yarn PnP, so PnP's own fixture work lands on a settled
   package-manager list rather than one still being broadened underneath it.

**Part 5 (a branch, after Part 4 merges):**

3. **Part 5** (Yarn Plug'n'Play support) — last, because it builds on the package-manager-addition
   shape Part 3 settled under the 2.4/2.5 pyramid (including the "one package-manager identity, linker
   detected and dispatched at scan time" pattern bun established), and because PnP is the first
   package manager that needs its own way of reading an install rather than reusing arborist or the
   pnpm hierarchy library.
