# license-cop migration plan

This plan adds dependency-scanning support for bun, then for Yarn Plug'n'Play. Infrastructure
modernization (package manager, task runner, linter, test runner, browser-test runner, CI) and the
CLI's internal architecture and public package boundary are complete. See "Suggested order" at the
end for the concrete sequencing and dependencies between the remaining steps.

## Guiding principles

- **license-cop's whole job is understanding other package managers.** Keep npm, pnpm, yarn
  classic and yarn modern dependency-scanning support (and add bun, then Yarn PnP) regardless of
  what the workspace itself is built with.
- **One big-bang branch per part, not one PR per item.** Part 3 (bun.lock support) and Part 4
  (Yarn Plug'n'Play support) each land as a single branch merged in one go, rather than each
  checklist item going out as its own PR. Within a branch, land the checklist items as separate
  commits in the order listed so the history stays legible and bisectable, but the repo only needs
  to be green again at branch-merge time, not after every individual commit.

## Part 3 — bun.lock support

A separate big-bang branch from Part 2: it depends on Part 2 having already relocated
`get-package-manager.ts` and the dependency-scanning modules into `@license-cop/core`, and — more
importantly now — on 2.4/2.5's test pyramid already being in place. Under the old fixture-matrix
shape, adding bun meant a full ~10-directory `e2e/bun/**` scenario set; under the pyramid, it means
one more entry in the contract test's package-manager list, because 2.4's classifier already covers scenarios package-manager-
agnostically.

- [ ] `@license-cop/core`'s `lib/dependency/get-package-manager.ts`: add `"bun"` to the
      `PackageManager` union; `tryResolveFromPackageManager` gains a
      `packageManager.startsWith("bun")` branch; `resolveFromLockFileDiscovery` checks for
      `bun.lock` (text) and `bun.lockb` (legacy binary format) alongside the existing
      `yarn.lock`/`pnpm-lock.yaml` checks.
- [ ] `lib/license-cop.ts`'s package-manager switch currently only special-cases `"pnpm"`, with
      everything else (`npm`, `yarn`) falling through to `npmDependencyScanning`. **Open
      question:** confirm whether a `bun install`-produced `node_modules` tree is arborist-readable
      the same way npm/yarn's is, or whether it needs its own `lib/dependency-scanning/bun.ts` —
      bun's default linker layout is npm-compatible, but this needs an actual test fixture to
      confirm rather than assuming. If it _is_ arborist-readable, bun may not need a new engine at
      all — just the detection change above, verified by one contract fixture (per 2.5's per-engine
      tier), the same way yarn needs none today.
- [ ] Add bun to the contract test: with the `"bun"` key added to `packages/cli-e2e` (next item), `contract.spec.ts` covers it automatically — the same project (`uses-isc` → `isc` transitively, plus `mit` as a dev dependency) installed fresh by bun. Check that bun's `overrides`/`resolutions` accept a `file:` tarball for the transitive `isc` redirect the way npm, pnpm and yarn do (spike it first, as was done for the others); if it doesn't, `PackageJsonBuilder`'s `overriding` needs a bun case.
- [ ] Extend `packages/cli-e2e`'s `PackageManager` type/`packageManagers` list (`package-managers.ts`) and `getInstallCommand` (`project.ts`) with a `"bun"` case (`bun install`, no frozen lockfile — projects are installed fresh from local tarballs).
- [ ] Add a `bun` leg to the CI `e2e` matrix (1.6).

## Part 4 — Yarn Plug'n'Play support

A fourth branch, after Part 3: it builds on the test pyramid from 2.5 and on Part 3 having already settled how a new package manager is added to `@license-cop/core` and `packages/cli-e2e` (bun was the first addition under the pyramid; this is the second, and the first one that isn't arborist-readable).

**Where things stand today (added during the final pass on 2.x).** Yarn 2+ defaults to Plug'n'Play, which installs no `node_modules` at all — just a `.pnp.cjs` resolution map and zipped packages in `.yarn/cache`. license-cop's npm engine reads `node_modules` through arborist, so before the final pass a PnP project scanned as an empty tree and printed "Done! No issues found" with exit code 0, even with a forbidden license in the dependency graph (confirmed with a real yarn 4 install). That silent false negative is fixed for now by detect-and-refuse: `assertNotPlugAndPlay` in `@license-cop/core` throws an `UnsupportedProjectError` when the project resolves to yarn and has a `.pnp.cjs`/`.pnp.js`, telling the user to set `nodeLinker: node-modules`. `packages/cli-e2e/src/lib/plug-and-play.spec.ts` covers it with real yarn 3 and yarn 4 PnP installs (via `createProject`'s `linker: "pnp"` option). This part replaces the refusal with real support.

- [ ] **Decide how to read a PnP install.** This needs a spike before anything is built, because PnP has no `node_modules` for arborist to load. Candidates: load the project's own `.pnp.cjs` (it exports a runtime API — `getAllLocators`, `getPackageInformation`, `resolveToUnqualified` — that gives every package's location and its dependency map) and walk it; or shell out to the project's own yarn (`yarn info --all --recursive --json`) and normalize its output. The former needs no yarn on the machine but has to read `package.json` out of `.yarn/cache/*.zip` (`@yarnpkg/fslib` + `@yarnpkg/libzip`, or unzipping ourselves) and out of `.yarn/unplugged`; the latter depends on a working yarn and on its JSON format staying stable across majors. Pick one against the real fixtures, the same way 3's open question about bun is settled by a real install rather than an assumption.
- [ ] `lib/dependency-scanning/yarn-pnp.ts` (or whatever the spike settles on): walk the PnP data into `NormalizedNode`s and hand them to `classifyDependencies` (2.4), so it stays a "read my package manager's native shape" module with no classification logic of its own. PnP data doesn't flag dev vs prod the way arborist's `node.dev` does, so the dev/prod split has to be derived by walking from the workspace root's own `dependencies` and `devDependencies`, the same shape of caveat 2.4 called out between the npm and pnpm engines — pin the behaviour with a test first.
- [ ] `lib/dependency/get-package-manager.ts` / `lib/license-cop.ts`: distinguish yarn-with-PnP from yarn-with-`node-modules` (today both are `"yarn"` and take the npm engine), and dispatch the former to the new engine. Then delete `assertNotPlugAndPlay` and `UnsupportedProjectError` if nothing else uses them by then — the error is the interim behaviour, not part of the design.
- [ ] Flip `packages/cli-e2e/src/lib/plug-and-play.spec.ts` from "is refused" to the same contract assertions `contract.spec.ts` makes (names, versions, licenses, dev/prod split for the default / include / only modes), for yarn 3 and yarn 4. The `linker: "pnp"` option on `createProject` and the yarn 3/4 aliases are already in place, so this is a test change rather than new harness work. Fold it into `contract.spec.ts`'s package-manager list if a PnP key reads more naturally there than a second spec file (decide alongside the `yarn-3`/`yarn-4` naming, which is deliberately linker-free today).
- [ ] Cover the PnP-specific shapes the contract fixture doesn't reach: workspaces, `npm:` aliases, `patch:` and `portal:`/`link:` protocols, packages in `.yarn/unplugged`, and zero-install repos (`.yarn/cache` committed, no install step). Decide which of these are in scope for a first version and say so in the docs.
- [ ] Docs: remove the "set `nodeLinker: node-modules`" guidance from the README, the copy in `packages/cli`, and `apps/website/src/pages/docs.md`, and document Plug'n'Play as supported.
- [ ] Add a Yarn PnP leg to the CI `e2e` matrix only if the contract-test approach above doesn't already cover it (it should — the matrix legs vary OS and Node, not package manager).

## Suggested order

**Part 3 (a branch):**

1. **Part 3** (bun.lock support) — on its own, once `@license-cop/core`'s package-manager
   detection, scanning modules, and the 2.4/2.5 test pyramid have already settled from Part 2.

**Part 4 (a branch, after Part 3 merges):**

2. **Part 4** (Yarn Plug'n'Play support) — after bun, because bun settles how a new package manager is added under the 2.4/2.5 pyramid, and because PnP is the first package manager that needs its own way of reading an install rather than reusing arborist or the pnpm hierarchy library.
