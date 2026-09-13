# license-cop migration plan

This plan modernizes license-cop's tooling and CLI architecture in three phases: infrastructure
(package manager, task runner, linter, test runner, browser-test runner, CI), the CLI's internal
architecture and public package boundary, and dependency-scanning support for bun. See "Suggested
order" at the end for the concrete sequencing and dependencies between steps.

## Guiding principles

- **license-cop's whole job is understanding other package managers.** Switching license-cop's own
  tooling to bun must not narrow what it can scan. Keep npm, pnpm, yarn classic and yarn modern
  dependency-scanning support (and add bun) regardless of what the workspace itself is built with.
- **Don't switch formatters without a working precedent for this codebase's file mix.** Prettier
  already formats `.ts`/`.astro`/`.scss`/`.mdx` correctly across the whole tree today. oxfmt's
  coverage of `.astro`/`.mdx`/`.scss` isn't established anywhere in this codebase or its tooling
  history, so there's no verified reason to swap a working formatter for an unproven one — stay on
  Prettier. ESLint still gets upgraded to latest (see 1.2) since that's independently justified
  (`.eslintrc.json` → flat config) and doesn't touch the formatter question at all; oxlint stays out
  of scope purely because of its own missing Astro support. **Correction:** ESLint doesn't have any
  existing Astro support in this codebase either — `apps/website` (the only place with `.astro`
  files) currently has no lint target and no `.eslintrc.json` at all. So Astro linting isn't a
  precedent to preserve through the ESLint upgrade (1.2); it's new functionality, split out into its
  own milestone (1.7) at the end of Part 1 so 1.2 stays scoped to the version/flat-config migration.
- **Infrastructure first, architecture second.** The CLI restructure (and the test-coverage work
  it unlocks) is much easier to do once the routine churn (formatter, linter, test runner,
  package manager, task runner) is already settled, so the diff for each is smaller and reviewable
  on its own.
- **Three big-bang branches, not one PR per item.** Each Part below (Infrastructure, Functional,
  bun.lock support) lands as a single branch merged in one go, rather than each checklist item
  going out as its own PR. Within a branch, land the checklist items as separate commits in the
  order listed so the history stays legible and bisectable, but the repo only needs to be green
  again at branch-merge time, not after every individual commit — Part 2 in particular is only
  coherent as a whole (splitting out `@license-cop/core` and reshaping the CLI flags touch the
  same files back to back).

## Part 1 — Infrastructure

### 1.1 pnpm → bun ✅ done

- [x] Add `bun.lock` (remove `pnpm-lock.yaml`), set `"packageManager": "bun@<version>"` in the
      root `package.json`, pinned to an exact version rather than a caret range — a workspace-wide
      bun bump should be a deliberate, reviewed change, not an incidental one.
- [x] Add a `bunfig.toml` with `linker = "isolated"` — bun's strict, non-hoisting linker, which
      keeps each package limited to its own declared dependencies the same way pnpm's own
      node_modules layout already does today, so this preserves an existing property rather than
      loosening it — plus a `publicHoistPattern`: Prettier resolves its plugins relative to the
      project root, so under the isolated linker the plugins pulled in by
      `@tobysmith568/prettier-config` need to be hoisted there explicitly, or Prettier won't find
      them. **Landed broader than planned:** ESLint 8's legacy `.eslintrc` resolves plugins (e.g.
      `eslint-plugin-jest`, pulled in transitively by `@tobysmith568/eslint-config`) relative to the
      *linted file's* directory rather than the shareable config's install location, so those need
      hoisting too — the pattern is `["*eslint*", "*prettier-plugin*"]`, matching the old
      `.npmrc`'s `*eslint*` rule rather than the narrower guess above. **The `*eslint*` half is only
      needed while on ESLint 8/legacy config** — flat config (1.2) has plugins imported directly by
      the config module instead of resolved per-linted-file, so drop it from `publicHoistPattern`
      once 1.2 lands.
- [x] Replace `.npmrc` pnpm settings with the `bunfig.toml` above. Check whether the
      `onlyBuiltDependencies` list in the current root `package.json` (`@swc/core`, `nx`,
      `cypress`, `sharp`, etc.) has a bun equivalent (`trustedDependencies`) once each of those
      tools is itself replaced/removed by the steps below — the final list will be shorter than
      today's. (Carried the list over unchanged for now as `trustedDependencies` — none of the tools
      it names have been replaced/removed yet, so there's nothing to shorten until later steps land.)
- [x] Workspaces: license-cop's `packages/*` layout maps directly to bun workspaces
      (`"workspaces": ["apps/*", "packages/*"]`).
- [x] Update every `pnpm run` / `pnpm dlx` / `pnpm exec` reference across scripts, CI workflows,
      READMEs and the `.github/actions/*` composite actions to `bun run` / `bunx`. Also caught
      `apps/website/project.json`'s three `pnpx astro *` commands (missed by a plain `pnpm` grep,
      since `pnpx` is the shorthand and doesn't contain the substring) — worth catching regardless
      of the rename, since `pnpx` re-resolves via `dlx` and was silently building the website
      against latest Astro instead of the pinned local version.
- [x] `e2e/pnpm/**` fixtures stay (pnpm is a package manager license-cop *scans*, independent of
      what the workspace itself uses to install). Only the workspace's own package manager changes.

**Found during implementation, not in the original plan:** nx 20.2.1's package-manager detection
only recognises the legacy binary `bun.lockb`, and parses it as a yarn-v1 lockfile — it has no
support for the modern text `bun.lock` this step adds. With `bun.lock` in place, nx's dependency
graph comes back empty, so `@nx/dependency-checks` started flagging every real dependency in
`packages/license-cop` and `packages/permissive` as unused. Disabled the rule
(`"@nx/dependency-checks": "off"`) in both packages' `.eslintrc.json` rather than downgrade to the
legacy lockfile format — nx is removed outright in 1.5 with no turborepo equivalent for this rule
(see 1.5's intro), so this just retires it a few steps early. The `Command`-from-`commander` import
hack in `packages/license-cop/src/index.ts` that this rule used to require (see 2.1) is therefore
already moot, though it hasn't been deleted yet — that cleanup still happens as part of 2.1, once
`index.ts` is being relocated anyway.

The workflows still check out via the external
`tobysmith568/actions/.github/actions/checkout-pnpm-project@main` composite action, which likely
still assumes a pnpm install — left as-is deliberately, since replacing it with a local
`.github/actions/setup` running `bun install` is 1.6's job, not this step's. Confirmed as the
intended sequencing rather than an oversight: CI doesn't need to be green again until Part 1's
branch actually merges (1.6 included), per this doc's own guiding principles above.

### 1.2 Upgrade ESLint to latest (not oxlint) ✅ done

- [x] Bridge step, done first: once flat config is in place (below), swap every package's `lint`
      target from `@nx/eslint:lint` to `nx:run-commands` running `eslint .` (root) / `eslint src`
      (per-package), so the new config is verified through the existing
      `pnpm nx run-many --target lint` and existing CI before 1.5 touches anything.
- [x] Bump `eslint` (currently pinned at `8.57.1`) to latest `9.x` (**not** `^10`:
      `@tobysmith568/eslint-config@^2.7.1`'s own `peerDependencies` pins `eslint: ^9.0.0`, so `^10`
      is a peer-dependency violation today). Drop `@typescript-eslint/eslint-plugin` and
      `@typescript-eslint/parser` (currently `7.18.0`) as direct dependencies entirely — flat config
      pulls `typescript-eslint` in transitively via `@tobysmith568/eslint-config`, and nothing else
      in the repo imports either package directly (only `.eslintrc.json`'s own rule names reference
      `@typescript-eslint/*`, which goes away with the legacy config it's part of). license-cop
      is still on the legacy `.eslintrc.json` format (`.eslintrc.json` + `.eslintignore` +
      per-package `.eslintrc.json` overrides); this is also the point to migrate to flat config
      (`eslint.config.mjs`):
      ```js
      import tobysmith568 from "@tobysmith568/eslint-config";
      export default [
        { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"] },
        ...tobysmith568.recommended
      ];
      ```
- [x] Bump `@tobysmith568/eslint-config` from `^1.1.2` to `^2.x` (breaking major — expect rule
      changes to shake out).
- [x] Drop the Nx-specific pieces of the current config once 1.5 lands: `@nx/enforce-module-boundaries`
      and the `plugin:@nx/typescript` / `plugin:@nx/javascript` overrides have no turborepo
      equivalent and simply go away rather than get replaced. (1.2's job is only to carry these
      forward into flat config unchanged — see below — not to drop them; that's still 1.5's job.)
- [x] Confirm `apps/website-e2e`'s Cypress specs still lint correctly under flat config with the
      upgraded parser — `@tobysmith568/eslint-config`'s Cypress rules key off a `**/*.cy.ts` glob,
      which matches this package's spec naming, so this should be a smoke check rather than a real
      unknown. (`.astro` files are out of scope here — see 1.7: there's no existing Astro lint
      coverage to carry through this upgrade, since `apps/website` isn't linted at all today.)

**Found during implementation, not in the original plan:**

- Also dropped `eslint-plugin-cypress` and `eslint-config-prettier` as direct devDependencies (the
  original checklist above only mentions the `@typescript-eslint/*` pair): both are already bundled
  by `@tobysmith568/eslint-config@2.7.1` and applied internally in its own `base.config.js`, and
  neither was imported directly anywhere in the repo — the root `.eslintrc.json` only ever extended
  `@tobysmith568/eslint-config/configs/node`, never either package by name.
- The real `eslint.config.mjs` is bigger than the sample above: the Nx-specific pieces (previous
  bullet) needed porting forward too, since dropping them is explicitly deferred to 1.5. `@nx/eslint-
  plugin@20.2.1` ships an official flat-config surface for this (`configs["flat/base"]`,
  `["flat/typescript"]`, `["flat/javascript"]` — the same pattern Nx's own generators produce), plus
  an `@nx/enforce-module-boundaries` rule block carrying forward the exact same options
  (`enforceBuildableLibDependency`, `allow`, `depConstraints`) from the old root `.eslintrc.json`.
  The old `@nx/dependency-checks: "off"` override (see 1.1's own found-during-implementation note)
  needed no equivalent at all — since it was fully disabled already, the new config just never wires
  that rule up in the first place, which is behaviourally identical with less code.
- `@typescript-eslint/no-extra-semi` — one of the two rules the `plugin:@nx/typescript` /
  `plugin:@nx/javascript` overrides existed to configure — no longer exists in modern
  `typescript-eslint`; it was removed upstream and referencing it throws at config-load time
  (`Could not find "no-extra-semi" in plugin "@typescript-eslint"`). Dropped the override entirely
  rather than porting it: plain `no-extra-semi` (already on by default via `eslint:recommended`)
  handles this correctly under modern parsers, which is exactly why the TS-specific variant was
  removed upstream in the first place.
- `eslint src` (per-package) doesn't work universally as originally planned: `packages/permissive`
  has no `src/` directory at all (it only ships a `.licenses.jsonc` asset — see 2.1's intro). Used
  `eslint .` (scoped via each `nx:run-commands` target's own `cwd`) for every package instead, which
  works regardless of a package's internal layout.
- `--max-warnings 0` moved from the root `nx run-many --target lint` invocation into each project's
  own `eslint . --max-warnings 0` command — relying on nx to forward an unrecognised flag through to
  an arbitrary `nx:run-commands` target isn't something to depend on; baking it into each command
  directly is simpler and unambiguous.
- The upgrade itself surfaced real, previously-unnoticed issues, fixed in scope rather than deferred:
  `lib/dependency/get-package-manager.ts`'s `catch (error) { return false; }` had an unused `error`
  binding that the old `@typescript-eslint` 7.18.0 setup wasn't catching — renamed to `_error` to
  match the config's `caughtErrorsIgnorePattern`. Separately, four `eslint-disable` comments turned
  out to be stale under the new rule set (confirmed empirically — ESLint itself reports "unused
  eslint-disable directive" once nothing on that line trips a rule any more): the blanket
  `/* eslint-disable */` at the top of all three packages' `jest.config.ts`, and the
  `// eslint-disable-next-line @typescript-eslint/no-unused-vars` guarding the `commander`-import
  hack in `packages/license-cop/src/index.ts` (see 1.1's note — the rule it was guarding against,
  `@nx/dependency-checks`, was already disabled in 1.1, and the underscore-prefixed identifier it
  disables the rule for already matches the config's own `varsIgnorePattern: "^_"`). Removed all
  four; the `commander`-import hack itself (the code, not just the disable comment) is untouched —
  that deletion is still 2.1's job, once `index.ts` is being relocated anyway.

### 1.3 Jest → bun:test

- [ ] Bridge step, done first: swap every package's `test`/`e2e` target from `@nx/jest:jest` to
      `nx:run-commands` running `bun test`, verified through the existing
      `pnpm nx run-many --target test` and existing CI before 1.5 touches anything.
- [ ] Every package currently on Jest (`packages/license-cop`, `packages/license-cop-e2e`,
      `packages/permissive`) moves to `bun test`: `"test": "bun test"` in each package's
      `package.json`, with no shared jest.config/preset at the root — bun:test's per-package config
      is simple enough that it doesn't need one.
- [ ] Remove `@swc/jest`, `ts-jest`, `jest-environment-node`, `@nx/jest`, `@types/jest`,
      root `jest.config.ts` / `jest.preset.js`, and every per-package `jest.config.ts` / `.swcrc`.
- [ ] `bun:test`'s API is Jest-compatible for the common matchers/`describe`/`it`/`beforeEach` used
      today, but `license-cop-e2e`'s spec (`packages/license-cop-e2e/src/lib/license-cop-e2e.spec.ts`)
      uses `describe.each` and spawns child processes with `child_process.spawn` — confirm both
      port cleanly (bun supports `describe.each`, but re-verify once ported since this suite is the
      one most likely to surface a gap).
- [ ] `packages/permissive/tests/index.spec.ts` is a trivial file-shape check — lowest-risk one to
      port first as a smoke test of the bun:test setup before tackling the bigger suites.
- [ ] Coverage reporting: current root `jest.preset.js` sets `coverageReporters: ["json", "html"]`
      for Codecov (see `ci.yml`'s `Codecov` step). `bun test --coverage` has a narrower reporter
      set — confirm it can still produce something Codecov's action accepts, or adjust/drop that
      CI step.

### 1.4 Cypress → Playwright

- [ ] Bridge step, done first: swap `website-e2e`'s `e2e` target from `@nx/cypress:cypress` to
      `nx:run-commands` running `bunx playwright test`, verified through the existing
      `pnpm nx run-many --target e2e` and existing CI before 1.5 touches anything.
- [ ] This affects `apps/website-e2e` only (the only Cypress consumer — `packages/license-cop-e2e`
      is a Jest/bun:test suite that drives the CLI via `child_process`, not a browser tool, and is
      unaffected by this item).
- [ ] Install Playwright per-app (`bunx playwright install --with-deps chromium firefox`, cached by
      `bun.lock`'s hash), and run tests via `bunx playwright test` / `turbo run e2e
      --filter=website-e2e`.
- [ ] license-cop's existing Cypress suite already uses the page-object pattern
      (`apps/website-e2e/src/support/page-objects/*.po.ts`) — that structure translates directly to
      Playwright's `Page`-based fixtures; this is a port of the page objects and specs, not a
      redesign.
- [ ] Drop `cypress`, `@nx/cypress`, `@testing-library/cypress`, `eslint-plugin-cypress`,
      `start-server-and-test` (Playwright's own webServer config in `playwright.config.ts` replaces
      the need to hand-orchestrate "start server, wait, run tests").
- [ ] Delete `apps/website-e2e/cypress.config.ts`, `.eslintrc.json` cypress override, and
      `apps/website-e2e/src/support/commands.ts` / `e2e.ts` (Cypress-specific bootstrapping).

### 1.5 nx → turborepo

Do this one **last** within Part 1, after 1.2–1.4. Nx is mostly just orchestrating shell commands
already — `apps/website`'s targets and several of `license-cop`/`permissive`'s
(`run`/`version`/`pack`/`publish`, `permissive`'s `build`) are already plain `nx:run-commands`, and
Prettier isn't wired through nx at all today (`ci.yml` runs `pnpm prettier --check .` directly). The
only nx-specific *executors* left in the repo are `@nx/js:swc` (license-cop's `build`),
`@nx/eslint:lint` (every package's `lint`), `@nx/jest:jest` (every package's `test`/`e2e`), and
`@nx/cypress:cypress` (`website-e2e`'s `e2e`) — each swap in 1.2–1.4 should land as a
`nx:run-commands` executor pointing at the new tool (`tsdown`, `eslint .`, `bun test`,
`bunx playwright test`) *first*, verified through the existing `pnpm nx run-many --target X` and
existing CI, before this step. That turns nx removal into "every target is already a thin wrapper
around a standalone command — delete the wrapper and rewrite CI to call the same commands directly"
instead of debugging new tools and a rewritten CI at the same time.

- [ ] Bridge step, done first: swap `license-cop`'s `build` target from `@nx/js:swc` to
      `nx:run-commands` running `tsdown` (replacing `.swcrc` + `@swc/cli` — turborepo isn't a
      bundler, so something has to be; `tsdown` is a bundler purpose-built for exactly this shape of
      package — a bun workspace, ESM, a CLI plus a library — so this is a straightforward
      `tsdown.config.ts` per package). Applies to `packages/license-cop` and, once it exists,
      `@license-cop/core` (see 2.1); `packages/permissive`'s `build` is already `nx:run-commands`
      and needs no bundler at all — it only ships a JSON file. Verify through the existing
      `pnpm nx run-many --target build` before touching anything else in this section.
- [ ] Add a `turbo.json` — `build` (`dependsOn: ["^build"]`), `typecheck`, `lint`, `test`, `e2e`
      (`cache: false`, since it shells out to real package-manager installs), `check` (composite of
      the above).
- [ ] Nx currently does more than task orchestration here — `@nx/eslint:lint`,
      `@nx/jest:jest`, and `@nx/dependency-checks` (the reason `index.ts` has to import
      `commander` just to stop it being flagged as unused — see 2.2, this hack goes away once
      commander itself is removed). Turborepo has none of this; each package's `package.json`
      needs its own `lint`/`test`/`build`/`typecheck` scripts.
- [ ] Remove `project.json` files (Nx-specific) once each package's `package.json` scripts and
      `turbo.json` cover the same ground.
- [ ] Retire `.nx/` cache dir, `nx.json`, and the `@nx/*` devDependencies.
- [ ] Delete `.github/workflows/nx.yml` (the automated Nx-migration workflow) — turborepo has no
      such migration mechanism and none is needed once nx is gone.
- [ ] `apps/website` is an Astro app; confirm Astro's dev/build scripts run fine invoked directly
      (`astro dev` / `astro build`) via turbo instead of through `@nx/js`'s wrapping — there's no
      existing precedent for this combination in the workspace, so it needs manual verification once
      turbo is wired up.

### 1.6 GitHub workflows

Current workflows (`ci.yml`, `cd.yml`, `nx.yml`, `website.yml`, `codeql.yml`) route through the
external `tobysmith568/actions` reusable workflows/composite actions. Move to self-contained local
composite actions instead (`.github/actions/setup` for the install/cache step, `.github/actions/
test-cli` for the CLI's own behavioural smoke tests) plus `workflow_call` reusable workflows for
CodeQL and Pages, so the workflow graph no longer depends on an external repo. Concretely:

- [ ] Add `.github/actions/setup/action.yml`: install bun (`oven-sh/setup-bun`), cache
      `~/.bun/install/cache` keyed on `bun.lock`, `bun install --frozen-lockfile`. Replaces every
      `tobysmith568/actions/.github/actions/checkout-pnpm-project@main` step.
- [ ] Fold `ci.yml` into one `integration.yml` triggered on `pull_request` + `push: main`, with
      `format` / `lint` / `typecheck` / `build` / `test` as separate parallel jobs — each failing
      with a precise name instead of one monolithic `lint` job that also runs Prettier.
- [ ] license-cop's own `e2e` job is more than an install-smoke-test would be: it's core product
      verification, matrixed over npm/yarn-classic/yarn-modern/pnpm × Node 20/22/24 ×
      Ubuntu/macOS/Windows, asserting the scanning logic against real installs of every supported
      package manager. Keep that matrix's *intent* untouched; only modernize its mechanics
      (bun-based setup, turbo-invoked). Add a `bun` leg once Part 3 (bun.lock support) lands.
- [ ] `local-licenses` / `published-licenses` jobs (license-cop dogfooding itself against its own
      dependencies) are worth keeping as-is — just re-point them at the turbo-built `dist/` output
      and `bunx license-cop`.
- [ ] `cd.yml` → a `deployment.yml` on `workflow_dispatch`: bump version → run integration → publish
      to npm (with `id-token: write` for provenance) → create the GitHub release → redeploy the docs
      site. The `purge-jsdelivr` step (for `@license-cop/permissive`) stays, slotted in after
      publish.
- [ ] `website.yml` → `pages.yml`: build → `configure-pages` → upload → `deploy-pages` (mostly
      already similar; mainly swap `pnpm nx run website:build` for `bunx turbo run build
      --filter=website`).
- [ ] `codeql.yml` → make it a `workflow_call`-able reusable workflow, called from both a `schedule`
      trigger and from `integration.yml`, instead of the current standalone scheduled+push+PR
      triggered copy — avoids running CodeQL twice on every PR.
- [ ] Delete `nx.yml` entirely (see 1.5).
- [ ] Pin action versions to their current latest majors (`actions/checkout@v7`,
      `actions/upload-artifact@v7`/`download-artifact@v8`, `github/codeql-action/*@v4`,
      `actions/configure-pages@v6`, `actions/deploy-pages@v5`) rather than license-cop's current
      older pins.

### 1.7 Add Astro linting

New functionality, not a preserved precedent — split out from 1.2 (see that section's correction
note) once it became clear `apps/website` isn't linted at all today. Done last within Part 1 so it
lands on top of the already-migrated flat config (1.2) and the already-migrated turborepo scripts
(1.5) rather than needing its own bridge step through Nx.

- [ ] Add `eslint-plugin-astro` and `astro-eslint-parser` (the plugin's own recommended parser for
      `.astro` files) as devDependencies.
- [ ] Extend the root `eslint.config.mjs` (from 1.2) with the plugin's flat `recommended` config,
      scoped to `apps/website/**/*.astro` — this repo's flat config is a single root file with
      glob-scoped overrides per package (see 1.2), so this is one more scoped block, not a new file.
- [ ] Give `apps/website` a `lint` script in its `package.json` (added alongside the rest of its
      turborepo scripts in 1.5) and wire it into `turbo.json`'s `lint` pipeline / the root
      `bun run lint`.
- [ ] Run it against the existing `.astro` files under `apps/website/src` and fix whatever the
      first real pass surfaces — there's no prior baseline to diff against, so expect some genuine
      findings rather than pure config churn.

## Part 2 — Functional changes

Breaking changes are in scope here — this is a major version bump, not a patch. The two big moves
(splitting out `@license-cop/core` and reshaping the CLI's public flags) both touch the CLI shell
at the same time, which is why this is one big-bang branch rather than several: doing them
separately would mean moving `lib/cli/**` twice.

### 2.1 Split out `@license-cop/core`

Today `packages/license-cop` is both the library (`src/index.ts` exports `checkLicenses`,
`LicenseCopOptions`, and the `result.ts` types — consumable by other code, e.g. anything scripting
against license-cop programmatically) and the CLI (`src/bin/license-cop`, `src/lib/cli/**`) in one
package. Split it the way a library-plus-CLI npm package generally benefits from splitting: a pure
engine package with no CLI concerns, and a thin CLI package that depends on it via `workspace:*`.

- [ ] New `packages/core`, npm name `@license-cop/core` (matches the existing `@license-cop/permissive`
      scoping). Move `lib/license-cop.ts`, `lib/result.ts`, `lib/config/**`, `lib/dependency/**`,
      `lib/dependency-scanning/**`, and `lib/spdx/**` into it wholesale — these modules are already
      options-in/data-out with no CLI dependency, so this is a move, not a rewrite.
  - `src/index.ts` becomes the entire public export surface: `checkLicenses`, `LicenseCopOptions`,
    and the result types — i.e. today's `packages/license-cop/src/index.ts`, relocated. Once it's
    the *only* place these are exported from, the current hack (importing `Command` from
    `commander` purely so `@nx/dependency-checks` doesn't prune the dependency) has nothing left to
    guard — it's already moot once nx is gone (1.5) and commander is dropped (2.2), so just delete
    it rather than port it.
- [ ] Rename `packages/license-cop` → `packages/cli` to make the split visually obvious; its
      `package.json` `"name"` stays `license-cop` (unscoped, matching the bin name — the package a
      user runs should be named after what they type to invoke it, not after a scoped library). It
      keeps only `src/bin.ts` and `src/lib/cli/**` (see 2.2) plus a `"@license-cop/core":
      "workspace:*"` dependency; it has no `"main"`/`"exports"` of its own — it's bin-only.
- [ ] Update every path that currently assumes `packages/license-cop`: the CI `local-licenses` job
      (`node ./dist/packages/license-cop/src/bin/license-cop`, see 1.6), `packages/license-cop-e2e`'s
      spawn target in `helpers.ts`, and any `tsconfig`/workspace references.
- [ ] `packages/license-cop`'s current `dependencies` split roughly in two: `@npmcli/arborist`,
      `@pnpm/reviewing.dependencies-hierarchy`, `axios`, `compare-versions`, `cosmiconfig`,
      `deepmerge`, `git-filesystem`, `json5`, and the domain-validation half of `zod`'s usage move to
      `@license-cop/core`'s `package.json`; the CLI package's own dependencies shrink to `zod` (for
      arg-schema validation, see 2.2) plus `@license-cop/core` — `commander` and
      `@commander-js/extra-typings` are dropped outright, not moved (see 2.2).
- [ ] Consider whether `packages/license-cop-e2e` should be renamed alongside (`cli-e2e`?) for
      consistency — cosmetic, not required.

### 2.2 CLI architecture: an `Io` seam instead of a singleton

With the core engine relocated, `packages/cli` (née `packages/license-cop`) is left holding exactly
the part of the codebase that's actually hard to test today: `lib/cli/**` reaches into a
module-level singleton (`lib/logger.ts`, `loggerEnabled`/`verboseEnabled` as mutable module state)
and mutates `process.exitCode` directly from inside commander `.action()` callbacks, so none of it
can be tested without either mocking a module or spawning a real subprocess — which is exactly why
`lib/cli/**` currently has zero unit tests (see 2.5) and the only coverage is the slow,
real-package-manager `license-cop-e2e` suite.

The fix is one seam: an `Io` interface threaded explicitly through every layer, `run(argv, io)` as
the one testable entry point, and `node:util.parseArgs` + `zod` doing what `commander` does today —
no framework, no global state, just plain data in and plain data out. Proposed mapping:

| Current | New | Notes |
|---|---|---|
| `src/bin/license-cop` (`require("../lib/cli").main(...)`) | `src/bin.ts` | Thin `process` glue only — parse, exit, top-level catch. ESM instead of a CJS shim. |
| `lib/cli/index.ts` (`main(args)`, calls `logger.enableLogging()`, `program.parseAsync`) | `src/main.ts` (`run(argv, io): Promise<number>`) | Returns an exit code instead of mutating `process.exitCode`; takes `io` as a parameter (defaulting to `defaultIo`) instead of a singleton. |
| `@commander-js/extra-typings` command tree (`create-command.ts`, `commands/main.ts`, `commands/init.ts`, `commands/version.ts`) | `src/args/schema.ts` + `src/args/parse.ts` | `parseArgs` (`node:util`) tokenizes; `zod` validates into a `CliInvocation` discriminated union. Drops the `commander`/`@commander-js/extra-typings` dependency entirely. What the invocation kinds actually are changes slightly here — see 2.3. |
| *(new)* | `src/errors.ts`: a `UsageError` class | Thrown by `args/parse.ts` when the command line itself is wrong (an unknown flag, a missing value) — distinct from failures that happen *after* a valid command line (a missing config file, a `ConfigError`), which the relevant command handler reports itself since a usage reminder wouldn't help there. |
| `commands/main.ts`'s inline `runLicenseCop` | `src/commands/check.ts` (`runCheck(options, io)`) | Takes validated options + `io`, returns an exit code, calls the existing `checkLicenses` from `@license-cop/core` unchanged. |
| `commands/init.ts`'s `initCommandAction` | `src/commands/init.ts` (`runInit(options, io)`) | Same pattern — currently calls `logger.log`/`writeFile` directly; route both through `io`. |
| `commands/version.ts` | folded into `src/help.ts` (`versionText()`) + a `"version"` `CliInvocation` case in `main.ts` | version/help are data, not commands with their own action bodies. |
| `report-failure.ts` / `report-success.ts` | same files, signature becomes `(result, io)` | Currently import the `logger` singleton directly — the only change needed is threading `io` through instead. |
| `lib/logger.ts` (singleton, `enableLogging`/`enableVerboseLogging` mutable state) | `src/io.ts` (`Io` interface: `stdout`, `stderr`, verbosity as an explicit field on the invocation/options rather than global state) | The behavioral piece worth keeping — verbose vs. normal output — moves from "a flag that mutates a singleton before anything runs" to "a value threaded through like every other option." |
| `ConfigError` (from `@license-cop/core` post-2.1) | unchanged, but caught in `run()` alongside the new `UsageError` | Currently caught deep inside `commands/main.ts`'s `.action()`; moving the catch up to `run()` means every entry point (not just the default command) benefits, and both error kinds get the same "print message, set exit code" treatment. |

### 2.3 Neaten the CLI flags (breaking changes allowed)

With commander gone and the invocation shape being rebuilt from scratch anyway (2.2), this is the
window to fix flag oddities that exist today mostly as artifacts of how commander was being used
rather than deliberate design. Worth deciding on explicitly rather than porting as-is:

- [ ] `-v`/`--version` is currently a fake "subcommand" (`versionCommand`, `.name("-v")`) — a
      commander idiom for faking a global flag as a command. Under `parseArgs` + `zod` this is just
      a normal `CliInvocation` case; the workaround disappears on its own, but it's worth
      re-checking the flag names read well outside of that constraint.
- [ ] `--init` exists twice: as its own `init` subcommand *and* as a top-level `--init` boolean flag
      on the main command that's a pure alias for the same action
      (`if (options.init) { await initCommandAction(...); return; }`). Decide whether the alias
      pulls its weight or whether one form should go.
- [ ] `-D, --include-dev` and `--dev-only` are two independent booleans covering overlapping
      ground (dev-in-addition-to-prod vs. dev-instead-of-prod). A single flag with a mode — e.g.
      `--dev-dependencies <include|only>`, defaulting to prod-only — would make the illegal
      "both true" combination unrepresentable instead of needing to be reasoned about at the call
      site.
- [ ] `--verbose` and `-d/--directory` are bolted onto every subcommand today via
      `create-command.ts`'s shared builder. Confirm both are actually meaningful on `init` (a
      directory, clearly yes; verbose logging for a single `writeFile`, less obviously) rather than
      just inherited because the builder was shared.
- [ ] Whatever the final flag set, update `lib/cli/commands/init.ts`'s generated `.licenses.json`
      template and the `--help` text together, and make sure `packages/license-cop-e2e`'s fixtures
      (`e2e/**/package.json` + `.licenses.json` pairs) still reflect real invocations of the CLI —
      several of those directories are named after the exact flag behaviour being asserted (e.g.
      `should-fail-when-a-package-is-specified-with-a-caret`), so a flag rename needs a pass over
      those too.

### 2.4 Extract a shared classifier out of the per-engine duplication

`lib/dependency-scanning/npm.ts` and `pnpm.ts` don't just duplicate structure — they duplicate the
actual license-classification logic (allow-list check → license-expression parsing →
`calculateIssues` → bucket into allowed/no-license/forbidden), and the code already flags this
itself:

```ts
// This function is very similar to the one in pnpm.ts
// If you change this, you probably want to change that one too
```

This is *why* the e2e fixture matrix is the only place that classification logic gets tested today
— there's no single place to unit-test "does license X get classified correctly" independent of an
engine, because that logic doesn't currently exist independent of an engine. Fixing this is a
prerequisite for 2.5, not just a nice-to-have refactor:

- [ ] Extract the shared part — given a normalized `{ name, version, packageJson, children }` node
      plus the resolved config (allowed licenses/packages, dev-dependency filtering), decide which
      bucket it falls into and recurse — into one function both engines call. Each engine's own
      code shrinks to just "walk my package manager's native tree shape and hand normalized nodes
      to the shared classifier."
- [ ] **Watch for one real behavioral difference while merging these:** `npm.ts` filters
      dev-dependencies per-node inside `parseNode` (checking `node.dev`), while `pnpm.ts` filters
      them upstream via `buildDependenciesTree`'s `include: { dependencies, devDependencies,
      optionalDependencies }` option. Both need to keep working the same way from the caller's
      perspective, so pin this down with a test *before* extracting, not after.
- [ ] Once extracted, this is exactly what unlocks 2.5's bottom tier: the classifier can be unit
      tested directly against hand-built normalized nodes, with zero package manager and zero
      install involved.

### 2.5 Restructure the e2e suite around a test pyramid

Today's `e2e/{npm,pnpm,yarn-classic,yarn-modern-with-node-modules}/**` fixture set is one directory
per (scenario × package manager) pair — roughly 10 scenarios × 4 package managers, each a full
`package.json` + lockfile (+, for both yarn variants, a `.yarnrc.yml` and a committed
`.yarn/releases/*.cjs` binary). Adding bun as a 5th package manager the same way (Part 3) would push
that past 50 near-identical directories. Two axes are being conflated here that don't need to be:
*which scenario* (package-manager-agnostic — this is what 2.4's classifier decides) and *which
package manager* (how you get from disk to a normalized tree at all). Worse, `npm` and both `yarn`
variants already run through the identical `npmDependencyScanning` path today (`lib/license-cop.ts`
only special-cases `pnpm`; everything else falls through to the npm engine) — so yarn's ~20
directories are currently just re-confirming a code path npm's fixtures already exercise.

Restructure into three tiers instead:

- [ ] **Unit: the classifier (2.4), tested once, package-manager-agnostic.** Every scenario
      currently expressed as an `e2e/<pm>/should-*` directory — missing license, forbidden license,
      semver ranges, the legacy `licenses` field, allowed packages, dev-dependency filtering — moves
      to a spec file that builds a small in-memory node tree and asserts the resulting
      `CheckLicensesResult` bucket. No install, no filesystem fixtures, no package manager.
- [ ] **Contract tests per engine, one or two real fixtures each.** For each engine that's
      genuinely distinct (npm, pnpm, and whatever bun turns out to need per Part 3's open question),
      keep a minimal real install — "simple deps" and "nested/transitive deps" is likely enough —
      asserting the engine correctly walks its package manager's native tree into normalized nodes
      (names, versions, license fields, dev/prod flags) and correctly applies dev-dependency
      filtering per the caveat in 2.4. This is *not* re-testing classification, just "does this
      engine read this package manager's on-disk state correctly."
- [ ] **Collapse `e2e/yarn-classic/**` and `e2e/yarn-modern-with-node-modules/**`** from ~10
      scenario directories each down to one or two confirming fixtures, since they exercise the
      same `npmDependencyScanning` path as `e2e/npm/**` and gain nothing from the full scenario
      matrix once 2.4/2.5's unit tier covers scenarios directly.
- [ ] **A handful of true smoke tests: the built CLI binary, one real install, seams only.** Args
      parsed → engine invoked → report printed → exit code — confirming the pieces wire together,
      not re-verifying every classification edge case again. `packages/license-cop-e2e` shrinks to
      this tier.
- [ ] Everything else currently untested stays on the list regardless of the above: `lib/cli/**`
      (zero spec files — the direct payoff of 2.2: once handlers take `io` as a parameter, testing
      them is a fake-io-and-assert-on-output affair, a few lines per test), `lib/license-cop.ts`'s
      package-manager dispatch switch and `resolvePath`, `lib/config/*` (`config.ts`'s zod parsing,
      `find-config.ts`, `load-config.ts`, `load-parent-config.ts`, and all three
      `parent-resolutions/{github,http,npm}.ts` modules, including the network-fetching ones — for
      those, consider the same DI seam as the CLI layer, injecting the fetcher rather than importing
      `axios` directly, so they get fast unit tests instead of needing a real network call), and
      `lib/dependency/get-package-manager.ts`/`package-json.ts`. (Already covered and unaffected by
      any of this: `lib/dependency/package-rules.ts`, `lib/spdx/get-tokens.ts`,
      `lib/spdx/parse-tokens.ts`, `lib/utils/join-string-array.ts`.)

## Part 3 — bun.lock support

A separate big-bang branch from Part 2: it depends on Part 2 having already relocated
`get-package-manager.ts` and the dependency-scanning modules into `@license-cop/core`, and — more
importantly now — on 2.4/2.5's test pyramid already being in place. Under the old fixture-matrix
shape, adding bun meant a full ~10-directory `e2e/bun/**` scenario set; under the pyramid, it means
one or two contract fixtures, because 2.4's classifier already covers scenarios package-manager-
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
      confirm rather than assuming. If it *is* arborist-readable, bun may not need a new engine at
      all — just the detection change above, verified by one contract fixture (per 2.5's per-engine
      tier), the same way yarn needs none today.
- [ ] Add one or two contract fixtures under `e2e/bun/**` (per 2.5's per-engine tier — "simple
      deps" and "nested/transitive deps" is likely enough), each with a `bun.lock` instead of
      `package-lock.json`. Not a full scenario-matrix duplicate of `e2e/npm/**` — the classifier
      already covers scenarios.
- [ ] Extend `packages/license-cop-e2e`'s `PackageManager` type and `getInstallProgram`/
      `getInstallArgs` (in `helpers.ts`) with a `"bun"` case (`bun install --frozen-lockfile`).
- [ ] Add a `bun` leg to the CI `e2e` matrix (1.6).

## Suggested order

**Part 1 (one branch):**

1. **1.1** (pnpm → bun) — foundational and orthogonal to nx; every later step needs `bun` on the
   path anyway.
2. **1.2, 1.3, 1.4** (ESLint upgrade, Jest → bun:test, Cypress → Playwright) — each lands as its
   new tool wired up via an `nx:run-commands` bridge (see each section's first checklist item),
   verified independently through the *existing* `pnpm nx run-many --target X` and existing CI.
   Order among these three doesn't matter; they touch disjoint parts of the tree.
3. **1.5** (nx → turborepo, incl. the `tsdown` bridge for `build`) — last among the infra items on
   purpose (see 1.5's intro): by this point every target is already a thin `nx:run-commands`
   wrapper around a standalone command, so removing nx is closer to "delete the now-redundant
   wrapper" than "debug a new tool and a rewritten CI at the same time."
4. **1.6** (workflows) — do last among the tool swaps, once every command it needs to shell out to
   (`bun run build`, `bun test`, `bunx playwright test`, etc.) already exists and works locally,
   and turborepo's own scripts (1.5) are in place for CI to call directly.
5. **1.7** (Astro linting) — genuinely last: new functionality layered on top of the already-settled
   flat config (1.2) and turborepo scripts (1.5), not part of the tool-for-tool swaps above.

**Part 2 (a second branch, after Part 1 merges):**

6. **2.1** (split out `@license-cop/core`) — a pure move; get the package boundary right before
   changing behaviour inside it.
7. **2.2** (CLI architecture) — restructure `packages/cli`'s `lib/cli/**` around `Io` +
   `parseArgs`/`zod`, now that it's a clean, small package on its own.
8. **2.3** (flag cleanup) — do this alongside 2.2 rather than after it; the flag schema and the
   parsing rewrite are the same diff.
9. **2.4** (extract the shared classifier) — do this before 2.5; the classifier extraction is what
   makes the e2e restructuring possible, not the other way round.
10. **2.5** (restructure the e2e suite) — follows directly from 2.4; land the three tiers
    incrementally within the branch (classifier unit tests, then per-engine contract fixtures, then
    trimming `packages/license-cop-e2e` down to seam-level smoke tests) rather than as one giant
    commit.

**Part 3 (a third branch, after Part 2 merges):**

11. **Part 3** (bun.lock support) — on its own, once `@license-cop/core`'s package-manager
    detection, scanning modules, and the 2.4/2.5 test pyramid have already settled from Part 2.
