# license-cop migration plan

This plan adds dependency-scanning support for bun, consolidates how a package manager is dispatched
to now that bun has shown the current shape straining under it, broadens npm's own fixture coverage
to match pnpm/yarn's thoroughness, then adds support for Yarn Plug'n'Play. Infrastructure
modernization (package manager, task runner, linter, test runner, browser-test runner, CI) and the
CLI's internal architecture and public package boundary are complete. See "Suggested order" at the
end for the concrete sequencing and dependencies between the remaining steps.

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
in `bunfig.toml`, or the default for a _workspace_ project since lockfile `configVersion: 1`,
explicitly modeled on pnpm: root `node_modules` holds only symlinks into a central store at
`node_modules/.bun/<name>@<version>/...`). This repo's own `bunfig.toml` already sets
`linker = "isolated"`, so isolated support isn't optional scope, it's required for `local-licenses`
(see CI, below) to ever pass against this repo's own tree.

- [x] `@license-cop/core`'s `lib/dependency/get-package-manager.ts`: add `"bun"` to the
      `PackageManager` union; `tryResolveFromPackageManager` gains a
      `packageManager.startsWith("bun")` branch; `resolveFromLockFileDiscovery` checks for
      `bun.lock` (text) and `bun.lockb` (legacy binary format), slotted in after the existing
      `yarn.lock`/`pnpm-lock.yaml` checks and before the npm default.
- [x] **`bun.lockb` (legacy binary lockfile): support it only if it comes for free.** There's no
      official library for reading it (only a stale, two-years-unmaintained community package), so
      don't hand-roll a binary-format parser for it. If the hoisted engine ends up needing no
      lockfile-content parsing at all (pure `node_modules` walking), or if `bun.lock` (text, which is
      plain JSON-ish) turns out easy enough to parse ourselves, extend that same support to
      `bun.lockb` for free. Otherwise, leave it unsupported. (`bun.lockb` predates isolated linker
      entirely, so a `bun.lockb`-based project is unlikely to ever need the isolated engine anyway.)
      Landed as reasoned: hoisted never touches the lockfile at all, so detection-only support for
      `bun.lockb` was free; isolated genuinely needs `bun.lock`'s text content.
- [x] **Engine dispatch, both linkers.** `PackageManager` stays a single `"bun"` value (linker isn't
      a package-manager identity, the same way yarn PnP vs. node-modules doesn't get its own
      `PackageManager` value either). Which linker an already-installed project used is detected at
      _scan_ time, inside a single `bun` entry in `lib/license-cop.ts`'s `scanners` record, once
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
      Landed as `bun-isolated.ts`, but not lockfile-driven as originally planned: `bun.lock`'s
      `packages` map doesn't reliably name a resolution's on-disk store folder (a `file:` dependency's
      is a hash, not `name@version`), which broke against this repo's own `apps/website` and the
      `file:`-tarball e2e fixtures. Resolves every dependency by following bun's own `node_modules`
      symlinks via `realpath` instead; `bun.lock` is read only for declared dependencies and
      workspace-member paths.
- [x] Add bun to the contract test, both linkers: extend `packages/e2e-fixtures`'s `PackageManager`
      type/`packageManagers` list (`package-managers.ts`) with `"bun-1-hoisted"` and
      `"bun-1-isolated"` (major-version pin only, not full patch granularity — `bun` is published to
      the npm registry with `bun`/`bunx` bins, so `"bun-1": "npm:bun@^1"` slots into
      `e2e-fixtures/package.json`'s devDependencies next to `pnpm-10`/`yarn-1`, with a matching
      `entryPoints` line in `fixtures.ts`). `createProject` must write its own `bunfig.toml` forcing
      the matching linker for _both_ entries explicitly, never relying on bun's own default (which
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
      `overrides` worked out of the box for both linkers, confirmed against a real `file:` tarball
      redirect; no workaround needed. Also needed `"bun"` added to root `trustedDependencies` (bun
      silently skips its own postinstall otherwise, leaving an error stub in place of the real
      binary), and `getBunEntryPoint()` runs it directly rather than via `node`, since bun ships a
      native binary (`bin/bun.exe`, that literal name on every OS) rather than a `.js` entry point.
- [x] CI: re-enable `local-licenses` (it runs this branch's own build,
      `node ./packages/cli/dist/bin.js`) once bun support actually works end to end against this
      repo's own isolated-linker install. **Leave `published-licenses` disabled** — it runs
      `bunx license-cop`, which resolves the _currently-published_ npm package, not this branch's
      code, so it can't pass until a release containing bun support has actually shipped; flip it in
      a follow-up PR at that point, restoring its original `if: inputs.is_release == false` condition.
      No change needed to the `e2e` job's OS/Node matrix itself, it varies OS/Node, not package
      manager, and `packageManagers` already carries the per-package-manager coverage.
      Re-enabling surfaced two real, pre-existing forbidden-license transitive deps this check had
      never actually run against before (`lightningcss`, `@img/sharp-libvips-*`, via `apps/website`'s
      `astro` dependency); allow-listed in `.licenses.json` rather than broadening the allowed
      licenses themselves.

## Part 4 — Consolidate package-manager dispatch

A separate branch, after Part 3 merges and before Part 5. Not a feature; a structural cleanup
prompted directly by what building bun exposed. `@license-cop/core` currently spreads each
package manager's per-identity concerns across several independent, exhaustively-typed structures
(`license-cop.ts`'s `scanners` record, `assert-installed.ts`'s `installCommands` record, and a
one-off `if (packageManager === "yarn") { await assertNotPlugAndPlay(...) }` special case in
`checkLicenses` that sits _outside_ that exhaustiveness guarantee) rather than one cohesive
structure per package manager. `packages/e2e-fixtures` has the same problem worse: `project.ts`'s
`getInstallCommand` switch, `package-json-builder.ts`'s overrides/resolutions switch, and
`fixtures.ts`'s `entryPoints` map are three separate exhaustive switches over the same
`PackageManager` type, kept in sync only by convention. Adding bun meant touching all of them, plus
hand-writing `bun.ts`, a bespoke dispatcher for "one package-manager identity, several install
shapes, detected at scan time" — exactly the shape Yarn PnP (Part 6) needs too, and exactly the
kind of one-off that should be a reusable pattern rather than copied by eye each time. Sequenced
ahead of Part 5 (not just Part 6) because Part 5 touches these same switch statements to add more
npm variants; doing this first means Part 5 adds each one as a single adapter object instead of
editing three files, rather than adding to the old shape and needing a second migration later.

**The domain has two axes, not one.** A package manager's **identity** (npm, yarn, pnpm, bun) is
what decides its install command and any precondition checks (the yarn-PnP check today). Its
**install shape** (npm-compatible hoisted `node_modules`, pnpm's virtual store, bun's isolated
store, soon yarn PnP's zip-based store) is what an engine actually knows how to walk. Most
identities have exactly one shape; bun has two, and yarn is about to. Today that second axis is
invisible in the types, bun's two-shape-ness is expressed entirely inside `bun.ts`'s function body.

**Not in scope: `classify-dependencies.ts` and `NormalizedNode`.** They're already the one part of
this design that works well: a single package-manager-agnostic classifier, and a shared interchange
shape every engine already produces regardless of how it walks its own tree. This part only touches
how a package manager is _identified_ and _dispatched_ to an engine, not what an engine hands off
once it's found one.

- [ ] **Settle the design with a spike against the real code before committing to it** (the same
      discipline Part 3 used for the engine questions); the sketch below is a starting point, not a
      decided shape. (1) A **package-manager adapter** per identity, replacing `scanners` +
      `installCommands` + the loose yarn-PnP `if` with one
      `Record<PackageManager, PackageManagerAdapter>` in `@license-cop/core`, each adapter holding at
      least an install command, a scanning engine (or a shape-detector for identities with more than
      one), and an optional `assertPreconditions` hook — turning today's yarn-only special case into
      a structured slot every adapter can use, not a branch bolted onto `checkLicenses`. (2) A
      **`DependencyScanningEngine`** per install shape: one shared skeleton — call the shape's own
      tree-walk, apply the dev/prod/optional-inclusion decision, hand the result to
      `classifyDependencies` — with exactly one swappable primitive per shape (the walk itself),
      rather than each engine re-deriving the whole sequence independently the way `npm.ts`, `pnpm.ts`
      and `bun-isolated.ts` do today, held in sync only by a comment ("same as pnpm.ts"). Whether that
      skeleton is a base class's template method or a factory function closing over the one swappable
      primitive is exactly what the spike should decide; the shape matters more than the syntax.
      Confirm during the spike whether pnpm's library-driven walk and bun's hand-rolled
      symlink-following can share more than the walk's entry/exit points; if the walk itself has to
      stay bespoke per engine, the shared skeleton is still worth it on its own. (3) An identity with
      more than one shape (bun today; yarn once PnP lands) needs its own
      `detectShape()`-style dispatch at scan time, the job `bun.ts` currently does by hand — decide
      whether that's a method every adapter can optionally implement, or a small shared helper
      adapters compose with.
- [ ] `@license-cop/core`: implement the settled design. `npm.ts`, `pnpm.ts` and `bun-isolated.ts`
      move onto the shared engine skeleton, so only their own tree-walk stays bespoke; `bun.ts` either
      disappears into the new shape-detection mechanism or shrinks to just the bun-specific detector;
      `assertNotPlugAndPlay`'s call site moves from its own `if` into the yarn adapter's
      `assertPreconditions`; and `license-cop.ts`'s `scanners` record and `assert-installed.ts`'s
      `installCommands` record both collapse into the one `PackageManagerAdapter` registry.
- [ ] `packages/e2e-fixtures`: the equivalent consolidation for the fixture side — one
      `Record<PackageManager, FixtureAdapter>` (install command, overrides shape, entry point)
      replacing `project.ts`'s `getInstallCommand`, `package-json-builder.ts`'s overrides switch, and
      `fixtures.ts`'s `entryPoints` map.
- [ ] Update Part 6 (Yarn Plug'n'Play, below)'s text once this lands: it currently says PnP's engine
      dispatch should follow "the same … shape Part 3 established for bun" — repoint that at
      whatever this part actually lands, since that's what PnP would be extending by then.

## Part 5 — Broaden npm fixture coverage

A separate branch, after Part 4 merges and before Part 6. Not part of bun support itself, it's a
standalone improvement: today `"npm"` in `packages/e2e-fixtures/src/package-managers.ts` means
"whatever ships with the Node.js under test," the only package manager tested that way, unlike
pnpm (`pnpm-10`/`11`/`12`) and yarn (`yarn-1`/`3`/`4`), which are each pinned to specific majors.
npm should get the same treatment. Sequenced after Part 4 so each new npm variant is added to the
consolidated adapter shape rather than the old scattered switches Part 4 is replacing.

- [ ] Decide which npm majors matter (mirroring how pnpm picked 10/11/12 and yarn picked 1/3/4), and
      whether the bare `"npm"` entry ("whatever ships with the Node.js under test") stays alongside
      the pinned ones or is replaced by them.
- [ ] Pin the chosen npm majors as npm-aliased devDependencies (`"npm-X": "npm:npm@^X"`) in
      `packages/e2e-fixtures/package.json`, with matching `entryPoints` lines in `fixtures.ts`
      (or its Part 4 replacement).
- [ ] Update every place currently keyed on the literal string `"npm"` to treat every pinned npm
      variant the same way: `toMemberSpecifiers`'s `usesWorkspaceProtocol` check and the `overrides`
      vs `resolutions` switch, both in `package-json-builder.ts` (or wherever Part 4 relocates them).

## Part 6 — Yarn Plug'n'Play support

A seventh branch (after Parts 3, 4 and 5 merge): it builds on the test pyramid from 2.5 and on
Part 4 having already settled how a package manager with more than one install shape is added to
`@license-cop/core` and `packages/e2e-fixtures` (bun was the first such addition, worked out by
hand in Part 3 and generalized in Part 4; this is the second, and the first one that isn't
arborist- or pnpm-library-readable).

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
   shape Part 4 generalized from what Part 3 worked out by hand for bun (the adapter registry, and
   the "one package-manager identity, several install shapes, detected at scan time" pattern), and
   because PnP is the first package manager that needs its own way of reading an install rather than
   reusing arborist or the pnpm hierarchy library.
