# license-cop migration plan

This plan modernizes license-cop's tooling and CLI architecture in four phases: infrastructure
(package manager, task runner, linter, test runner, browser-test runner, CI), the CLI's internal
architecture and public package boundary, dependency-scanning support for bun, and dependency-scanning support for Yarn Plug'n'Play. See "Suggested
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
      _linted file's_ directory rather than the shareable config's install location, so those need
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
- [x] `e2e/pnpm/**` fixtures stay (pnpm is a package manager license-cop _scans_, independent of
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
      `js
import tobysmith568 from "@tobysmith568/eslint-config";
export default [
{ ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"] },
...tobysmith568.recommended
];
`
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

### 1.3 Jest → bun:test ✅ done

- [x] Bridge step, done first: swap every package's `test`/`e2e` target from `@nx/jest:jest` to
      `nx:run-commands` running `bun test --isolate` (with `cwd` set to the package, the same
      pattern 1.2 already used for `lint` — a raw command + `cwd` in `project.json`, not a
      `package.json` script), plus a `ci` configuration overriding the command to add
      `--coverage --coverage-reporter=lcov` (see the coverage bullet below). Verified through the
      existing `pnpm nx run-many --target test` and existing CI before 1.5 touches anything.
      `--isolate` runs each test file in a fresh global object, matching bun's own recommendation
      for suites like `license-cop-e2e`'s that spawn child processes and could otherwise leak
      handles across files.
- [x] Every package currently on Jest (`packages/license-cop`, `packages/license-cop-e2e`,
      `packages/permissive`) moves to `bun test`, with no shared jest.config/preset at the
      root — bun:test's per-package config is simple enough that it doesn't need one. **The
      `"test": "bun test"` `package.json` script itself is deferred to 1.5**, not added here: while
      nx is still orchestrating targets, the `nx:run-commands` command _is_ the invocation (per the
      bridge-step bullet above), so a package.json script would just be unused duplication until
      turborepo (which discovers tasks via package.json scripts, not `project.json`) actually needs
      it. This also means `packages/license-cop-e2e` — which currently has no `package.json` at
      all — doesn't need one created for this step either; `nx:run-commands` works against a
      directory with no `package.json`.
- [x] Remove `@swc/jest`, `ts-jest` (already dead — listed in root `package.json` but not actually
      referenced anywhere), `jest-environment-node`, `@nx/jest`, `@types/jest`, root
      `jest.config.ts` / `jest.preset.js`, and every per-package `jest.config.ts`. **`.swcrc` is
      _not_ uniformly safe to remove yet:** `packages/license-cop`'s `build` target is still
      `@nx/js:swc` until 1.5's tsdown swap, and swc auto-discovers `.swcrc` from the package root
      with no explicit path configured in `project.json` — deleting it now would silently break
      that build. `packages/permissive`'s `build` is already plain `nx:run-commands` (no swc
      involved) and `packages/license-cop-e2e` has no `build` target at all, so those two `.swcrc`
      files _are_ safe to remove now; only `packages/license-cop/.swcrc` stays until 1.5.
      Add `@types/bun` as a devDependency and swap `"types": ["jest", "node"]` for
      `"types": ["bun", "node"]` in each package's `tsconfig.spec.json`, so `describe`/`it`/`expect`
      keep resolving without needing explicit `bun:test` imports.
- [x] `bun:test`'s API is Jest-compatible for the common matchers/`describe`/`it`/`beforeEach` used
      today — confirmed by running the existing `packages/license-cop` and `packages/permissive`
      suites unmodified (bar the `bun:test` imports noted below) under `bun test --isolate` (37 and
      2 tests respectively, all passing). `license-cop-e2e`'s spec
      (`packages/license-cop-e2e/src/lib/license-cop-e2e.spec.ts`) uses `describe.each` and spawns
      child processes with `child_process.spawn` — both confirmed working: the full suite ran 60
      real-install scenarios across npm/pnpm/yarn-classic/yarn-modern, 42 passing (all of npm's and
      pnpm's, plus every happy-path case); the remaining 18 failures are all yarn "unhappy path"
      cases and are fully explained by `yarn` not being installed in the verifying sandbox
      (`yarn: not found`), not by anything in the port.
- [x] `packages/permissive/tests/index.spec.ts` is a trivial file-shape check — lowest-risk one to
      port first as a smoke test of the bun:test setup before tackling the bigger suites.
- [x] Coverage reporting: current root `jest.preset.js` sets `coverageReporters: ["json", "html"]`
      for Codecov (see `ci.yml`'s `Codecov` step). Confirmed `bun test --coverage
--coverage-reporter=lcov` produces a standard `lcov.info`, which `codecov/codecov-action`
      ingests natively — use that reporter (wired into the `ci` configuration in the bridge-step
      bullet above) instead of `json`/`html`. (`packages/permissive` produces no `lcov.info` at all
      — expected, since it has no source code to instrument, true under Jest too.)

**Found during implementation, not in the original plan:**

- `describe`/`it`/`expect`/`afterEach` needed explicit `import { ... } from "bun:test"` added to
  every spec file (and to `license-cop-e2e/helpers.ts`, which calls `expect` outside a test body) —
  unlike `@types/jest`, `@types/bun` doesn't ambiently declare these as globals for `tsc`, even
  though `bun test` does inject them as real globals at runtime.
- `license-cop-e2e`'s spec resolves its e2e fixtures via a workspace-root-relative path
  (`join("./e2e", packageManager, directory)` in `helpers.ts`), which only worked under the old
  `@nx/jest:jest` executor because nx always ran jest from the workspace root regardless of where
  `jest.config.ts` lived. Setting `cwd: "packages/license-cop-e2e"` on the new `nx:run-commands`
  target broke that path silently — `child_process.spawn`'s `cwd` pointed at a directory that
  doesn't exist, which surfaced as a confusing `ENOENT: no such file or directory, posix_spawn
'/bin/sh'` rather than a clear "directory not found". Fixed by dropping `cwd` (defaulting to the
  workspace root, matching the old behavior) and instead scoping the command to this package via a
  `bun test` file-pattern argument: `bun test --isolate --timeout=60000 packages/license-cop-e2e/src`.
- `packages/license-cop`'s and `packages/permissive`'s `.swcrc` files were listed for removal in the
  original checklist, but `packages/license-cop`'s is still load-bearing: its `build` target is
  `@nx/js:swc` until 1.5, and swc auto-discovers `.swcrc` from the package root with no explicit
  path in `project.json`. Removed `packages/license-cop-e2e`'s and `packages/permissive`'s `.swcrc`
  (neither's `build` — the latter has none, the former isn't a build target at all — touches swc)
  but kept `packages/license-cop/.swcrc` until 1.5's tsdown swap.
- `jest` itself (the core package, not just `@nx/jest`/`@swc/jest`) was dropped from root
  `package.json` too, even though the original checklist didn't name it explicitly — nothing in the
  repo imports it directly, and once `@nx/jest:jest` is gone it has no remaining purpose.
- Added a name-keyed `"test"` entry to `nx.json`'s `targetDefaults` (mirroring the existing `"e2e"`
  entry) so caching survives the executor swap: the old caching config lived under the
  executor-keyed `"@nx/jest:jest"` entry, which stopped applying the moment these targets switched
  to `nx:run-commands`. That now-orphaned entry was removed.

### 1.4 Cypress → Playwright ✅ done

- [x] Bridge step, done first: swap `website-e2e`'s `e2e` target from `@nx/cypress:cypress` to
      `nx:run-commands` running `bunx playwright test`, verified through the existing
      `pnpm nx run-many --target e2e` and existing CI before 1.5 touches anything.
- [x] This affects `apps/website-e2e` only (the only Cypress consumer — `packages/license-cop-e2e`
      is a Jest/bun:test suite that drives the CLI via `child_process`, not a browser tool, and is
      unaffected by this item).
- [x] Install Playwright per-app (`bunx playwright install --with-deps chromium firefox`, cached by
      `bun.lock`'s hash), and run tests via `bunx playwright test` / `turbo run e2e
--filter=website-e2e`.
- [x] license-cop's existing Cypress suite already uses the page-object pattern
      (`apps/website-e2e/src/support/page-objects/*.po.ts`) — that structure translates directly to
      Playwright's `Page`-based fixtures; this is a port of the page objects and specs, not a
      redesign. Each page-object/component class now takes `page: Page` via its constructor instead
      of reaching for a global `cy`, and every assertion method became `async`.
- [x] Drop `cypress`, `@nx/cypress`, `@testing-library/cypress`, `eslint-plugin-cypress`,
      `start-server-and-test` (Playwright's own webServer config in `playwright.config.ts` replaces
      the need to hand-orchestrate "start server, wait, run tests"). **`eslint-plugin-cypress` was
      already gone** — 1.2's own found-during-implementation notes record it being dropped back then
      (it's bundled by `@tobysmith568/eslint-config`), so there was nothing left to remove here.
- [x] Delete `apps/website-e2e/cypress.config.ts`, `.eslintrc.json` cypress override, and
      `apps/website-e2e/src/support/commands.ts` / `e2e.ts` (Cypress-specific bootstrapping). **No
      `.eslintrc.json` cypress override existed to delete** — the repo migrated to flat config
      (`eslint.config.mjs`) in 1.2, and Cypress's globals there are scoped by the shared config's own
      `**/*.cy.[cm]?(j|t)s?(x)` glob, not a repo-local override; it simply stops matching anything
      now that the spec files are `.spec.ts`. Also deleted `src/fixtures/example.json`, Cypress's
      unused scaffold fixture (nothing in the suite referenced it).

**Found during implementation, not in the original plan:**

- `.github/workflows/website.yml` (the Pages deployment workflow, not just `ci.yml`) has its own
  `e2e` job with the same Cypress install/`start-server-and-test` invocation and Cypress-specific
  screenshot/video artifact upload steps — a second Cypress consumer this section's checklist didn't
  call out. Updated it the same way as `ci.yml`: `bunx playwright install --with-deps chromium
firefox` replaces `bunx cypress install`, `bunx nx run website-e2e:e2e` replaces the
  `start-server-and-test` wrapper (Playwright's own `webServer` config starts/reuses the server), and
  the screenshot/video artifact uploads became a single `playwright-report/` upload.
- Playwright's default `outputDir` resolves relative to the _nearest `package.json`_, not the config
  file's own directory — `apps/website-e2e` has no `package.json` of its own (deliberately, per
  1.3's note about `packages/license-cop-e2e`), so artifacts were landing in a `test-results/` at the
  workspace root instead of scoped to the package. Fixed by setting `outputDir: "./test-results"`
  explicitly in `playwright.config.ts`, which resolves relative to the config file itself.
- `apps/website-e2e/src/e2e/components/footer.cy.ts`'s `beforeEach` had a latent bug: it always
  reassigned the loop variable to `new IndexPageObject()` regardless of which page-object the current
  fixture row actually supplied, so every iteration exercised `IndexPageObject`'s `footer()` rather
  than the fixture's own. Harmless in practice (`footer()` returns the same `FooterComponent` shape
  on every page object), but a straightforward port naturally uses the fixture's own factory instead
  — matching how `header.cy.ts` (no such bug) already did it — so the ported `footer.spec.ts` fixes
  this along the way rather than carrying it forward.
- Added `use.screenshot: "only-on-failure"` and `use.video: "retain-on-failure"` plus a CI-only HTML
  reporter to `playwright.config.ts` — not in the original checklist, but needed to give
  `website.yml`'s "upload E2E artifacts on failure" step (which existed for Cypress) something
  equivalent to upload under Playwright.

### 1.5 nx → turborepo ✅ done

Do this one **last** within Part 1, after 1.2–1.4. Nx is mostly just orchestrating shell commands
already — `apps/website`'s targets and several of `license-cop`/`permissive`'s
(`run`/`version`/`pack`/`publish`, `permissive`'s `build`) are already plain `nx:run-commands`, and
Prettier isn't wired through nx at all today (`ci.yml` runs `pnpm prettier --check .` directly). The
only nx-specific _executors_ left in the repo are `@nx/js:swc` (license-cop's `build`),
`@nx/eslint:lint` (every package's `lint`), `@nx/jest:jest` (every package's `test`/`e2e`), and
`@nx/cypress:cypress` (`website-e2e`'s `e2e`) — each swap in 1.2–1.4 should land as a
`nx:run-commands` executor pointing at the new tool (`tsdown`, `eslint .`, `bun test`,
`bunx playwright test`) _first_, verified through the existing `pnpm nx run-many --target X` and
existing CI, before this step. That turns nx removal into "every target is already a thin wrapper
around a standalone command — delete the wrapper and rewrite CI to call the same commands directly"
instead of debugging new tools and a rewritten CI at the same time.

- [x] Bridge step, done first: swap `license-cop`'s `build` target from `@nx/js:swc` to
      `nx:run-commands` running `tsdown` (replacing `.swcrc` + `@swc/cli` — turborepo isn't a
      bundler, so something has to be; `tsdown` is a bundler purpose-built for exactly this shape of
      package — a bun workspace, ESM, a CLI plus a library — so this is a straightforward
      `tsdown.config.ts` per package). Applies to `packages/license-cop` and, once it exists,
      `@license-cop/core` (see 2.1); `packages/permissive`'s `build` is already `nx:run-commands`
      and needs no bundler at all — it only ships a JSON file. Verify through the existing
      `pnpm nx run-many --target build` before touching anything else in this section. **Landed as a
      direct `package.json` `build` script instead of an intermediate `nx:run-commands` bridge** —
      by this point in the session nx was being removed in the same pass rather than staged commit by
      commit, so the "verify via the old runner first" step became "verify via `tsdown` directly,
      then remove nx" instead.
- [x] Add a `turbo.json` — `build` (`dependsOn: ["^build"]`), `typecheck`, `lint`, `test`, `e2e`
      (`cache: false`, since it shells out to real package-manager installs), `check` (composite of
      the above). **`check` landed as a root `package.json` script (`turbo run build lint test
typecheck`) rather than its own `turbo.json` task** — `turbo run` already accepts multiple task
      names in one invocation and runs each one's own dependency graph, so a dedicated aggregator
      task/script per package would have been pure duplication.
- [x] Nx currently does more than task orchestration here — `@nx/eslint:lint`,
      `@nx/jest:jest`, and `@nx/dependency-checks` (the reason `index.ts` has to import
      `commander` just to stop it being flagged as unused — see 2.2, this hack goes away once
      commander itself is removed). Turborepo has none of this; each package's `package.json`
      needs its own `lint`/`test`/`build`/`typecheck` scripts.
- [x] Remove `project.json` files (Nx-specific) once each package's `package.json` scripts and
      `turbo.json` cover the same ground.
- [x] Retire `.nx/` cache dir, `nx.json`, and the `@nx/*` devDependencies.
- [x] Delete `.github/workflows/nx.yml` (the automated Nx-migration workflow) — turborepo has no
      such migration mechanism and none is needed once nx is gone.
- [x] `apps/website` is an Astro app; confirm Astro's dev/build scripts run fine invoked directly
      (`astro dev` / `astro build`) via turbo instead of through `@nx/js`'s wrapping — there's no
      existing precedent for this combination in the workspace, so it needs manual verification once
      turbo is wired up. Confirmed: `bunx astro build`/`bunx astro dev`/`bunx astro preview` wrapped
      as plain `package.json` scripts work unchanged under turbo.

**Explicit correction made mid-implementation:** nx's own convention is a centralized `dist/<layout>/<project>` output tree at the workspace root (mirrored by `coverage/<layout>/<project>` for test coverage) — the first pass of this milestone carried that layout forward unchanged (via `$TURBO_ROOT$`-anchored `outputs` in per-package `turbo.json` overrides) purely to minimize collateral changes to `helpers.ts`/`ci.yml`/`tools/scripts/*`. That's itself an nx-shaped convention, not a turborepo one, and out of place in a repo whose whole point is to stop looking like an nx workspace. **Corrected to local, per-package `dist`/`coverage` directories** (`packages/license-cop/dist`, `packages/permissive/dist`, `apps/website/dist`, and the matching `coverage/` siblings) — the default, idiomatic turborepo shape. This is simpler in every respect: `turbo.json`'s `outputs: ["dist/**"]`/`["coverage/**"]` need no root-anchoring trick and no per-package override files at all (only `license-cop-e2e` still needs its own `turbo.json`, purely to declare an explicit `license-cop#build` task dependency that no `package.json` dependency edge expresses, since it invokes the CLI as a subprocess rather than `import`/`require`ing it). Old root-level `dist/`/`coverage/` directories were deleted; `.gitignore`'s `dist`/`coverage` entries were already unanchored (no leading `/`) so they cover the new nested locations unchanged, but `.prettierignore`'s equivalent entries (`/dist`, `/coverage`) were root-anchored and had to be un-anchored to match. Downstream references that assumed the old centralized path were updated to match: `packages/license-cop-e2e/src/lib/helpers.ts`'s spawn target, and `tools/scripts/{version,pack,publish,copy-asset}.mjs`'s output-path computation (see below).

**Found during implementation, not in the original plan:**

- `.idea/nx-angular-config.xml` (an IDE-generated nx artifact) and `bunfig.toml`'s `"*eslint*"`
  `publicHoistPattern` entry (flagged in 1.1's own note as removable "once 1.2 lands," but never
  actually removed then) were both deleted here as small, low-risk cleanup found while auditing the
  repo for anything nx-flavored.
- `packages/license-cop/src/lib/config/load-config.ts` imported `deepmerge` as `import * as deepMerge
from "deepmerge"` and called it directly (`deepMerge(a, b)`) — this only ever worked because swc's
  `noInterop: true` setting happened to bind a wildcard import straight to `module.exports` for a CJS
  module with no `__esModule` flag. tsdown/rolldown's CJS output implements real namespace-import
  semantics, under which `deepMerge` would resolve to an uncallable namespace object instead of the
  function — rolldown's build even flagged this explicitly
  (`[CANNOT_CALL_NAMESPACE] Cannot call a namespace`). Fixed to `import deepMerge = require("deepmerge")`,
  matching the exact CJS-interop pattern this codebase already uses in
  `lib/dependency-scanning/npm.ts` for the same `esModuleInterop: false` reason.
- Removing `@nx/eslint-plugin`'s `flat/typescript`/`flat/javascript` blocks from `eslint.config.mjs`
  (see 1.2's own note that these were only ever carried forward pending 1.5) turned out to be load-
  bearing for more than `@nx/enforce-module-boundaries` and the already-dead `no-extra-semi` override:
  it was also silently satisfying `@typescript-eslint/no-require-imports` for the `import X =
require(...)` pattern used in both `npm.ts` and (per the previous bullet) now `load-config.ts` too.
  Without it, plain `typescript-eslint` recommended rules flag `import X = require(...)` the same as a
  bare `require()` call. Added an explicit `{ allowAsImport: true }` rule option in `eslint.config.mjs`
  instead of reintroducing any nx config, scoped to exactly the TS import-equals-require syntax this
  codebase deliberately relies on.
- The first pass at `packages/license-cop`'s `tsdown.config.ts` reached for `bundle: false` (re-emit
  every source file 1:1, mirroring the whole `src/` tree into `dist/src/**`) purely to keep the
  existing bin shim's hand-written `require("../lib/cli")` path working unchanged, and then needed
  increasingly unnatural options to compensate (a custom `outExtensions` callback to stop tsdown
  defaulting to `.cjs`, plus copying the raw bin file into `dist` as a separate asset). **Corrected**:
  tsdown is meant to be used with explicit, bundled entry points, so the config now reads `entry: {
index: "src/index.ts", bin: "src/bin.ts" }`, producing exactly `dist/index.js` and `dist/bin.js`
  with every internal import inlined — no tree-mirroring, no separate asset copy. This needed a real
  (if small) source change: `src/bin/license-cop` (a plain, extension-less JS shim with a shebang,
  doing `require("../lib/cli").main(process.argv)`) is gone, replaced by `src/bin.ts` — the exact same
  call, just as real TypeScript tsdown can compile as its own entry:
  ```ts
  #!/usr/bin/env node

  import { main } from "./lib/cli";

  main(process.argv);
  ```
  This is packaging-layer only — `lib/cli/**`'s own internals (still commander, still the module-level
  `logger` singleton) are completely untouched, so it doesn't reach into 2.2's job. Two more things
  fell out of this for free: tsdown auto-detects the shebang in `bin.ts` and chmods the compiled
  `dist/bin.js` executable on its own (`ℹ Granting execute permission to dist/bin.js`), so the
  `git ls-files -s` mode-`100644`-on-the-source-shim problem an earlier pass here had to work around
  doesn't exist any more — there's no checked-in shim file left to have the wrong mode; and
  `fixedExtension: false` (tsdown's own switch for "the package's `type` field already disambiguates
  the extension, don't force `.cjs`/`.mjs`") replaces the custom `outExtensions` callback outright.
  What's still needed, unrelated to the above: the config file itself still needs a `.mts` extension
  (Node's loader can't load a `.ts` ESM config from inside a `"type": "commonjs"` package without
  hitting a known Node bug), and `tsconfig.json`'s composite `references` still aren't understood by
  rolldown-plugin-dts's default mode, so both `tsdown`'s own `tsconfig` option and its `dts.tsconfig`
  sub-option still point at the leaf `tsconfig.lib.json` rather than the referencing root.
- The first pass at replacing `@nx/js:swc`'s dist-`package.json` generation copied the package's real
  `package.json`/`README.md`/`LICENSE.md` into `dist/` at build time (via a small custom script) so
  that `dist/` could stand in as a self-contained "fake" package root. That's solving a problem that
  doesn't need solving: `package.json` never needs to move at all. `npm pack`/`bun pm pack`/`npm
publish` already assemble the published tarball from the _real_, in-place `package.json` plus
  whatever its `"files"` field lists (`README.md`/`LICENSE.md`/`package.json` itself are included
  automatically by convention, confirmed empirically — `bun pm pack` on `packages/permissive` picked
  up `LICENSE.md` with no `"files"` entry naming it at all). **Corrected**: `package.json` stays where
  it is; `"main"`/`"types"`/`"bin"` point straight at `./dist/...`; `"files": ["dist"]` is the only
  addition needed. The custom dist-`package.json` script (and the `"scripts"`-stripping and
  `"version": "*"`-placeholder-handling it existed for) is gone entirely — nothing needs to strip
  `"scripts"` from a package.json that was never copied anywhere, and real npm packages routinely ship
  their dev `"scripts"` block as-is, so that was never a real problem either. The whole `tools/scripts/`
  directory (`version.mjs`, `pack.mjs`, `publish.mjs`, `copy-asset.mjs`, and the dist-`package.json`
  script, all of which had already had their `@nx/devkit` project-graph lookups stripped out in an
  earlier pass) is deleted outright, along with `tools/tsconfig.tools.json` — bun's own tooling already
  covers everything they did: `"version": "bun pm pkg set version=$VERSION"`, `"pack": "bun pm pack"`,
  `"publish": "npm publish *.tgz --access public --provenance --tag $NPM_TAG"`. The `"*"` version
  placeholder became `"0.0.0"` (valid semver, reads as "unversioned") purely because an _unversioned_
  build still needs to be a resolvable package for things like `license-cop-e2e`'s `npm exec` against
  it — unrelated to the dist-root correction, and it stays `"0.0.0"` under the new approach too.
  `packages/license-cop` and `packages/permissive` each gained their own `README.md`/`LICENSE.md`
  (copied from the workspace root once, not generated at build time) so every publishable package
  looks the same — `packages/permissive` already had a `README.md`; every `packages/e2e/*` fixture
  already had one too (see below).
- `packages/license-cop-e2e/src/lib/helpers.ts` needed two, unrelated fixes for the same reason (a
  turborepo/bun-workspace script always runs with `cwd` set to its own package directory, unlike the
  old `nx:run-commands` `e2e` target which ran with no `cwd` override, defaulting to the workspace
  root): its `e2e/<pm>/<scenario>` fixture-directory lookup used to be `join("./e2e", packageManager,
directory)`, a path relative to `process.cwd()` that doesn't exist once `cwd` is the package
  directory — anchored to the file's own location instead (`join(__dirname, "../../../..")` as
  `workspaceRoot`), removing the `cwd`-dependence entirely. Separately, once the dist-root correction
  above landed, its `npm exec` target needed to change from `packages/license-cop/dist` (a stand-in
  "fake package root" under the old approach) to `packages/license-cop` itself (the real package root,
  now that `package.json` lives there rather than being copied into `dist/`).
- `apps/website-e2e`, `apps/website`, and `packages/license-cop-e2e` had no `package.json` at all
  (by design, per 1.3's own note for the latter) — each needed one added purely to give turbo a
  workspace member with scripts to run; `apps/website-e2e/playwright.config.ts`'s `webServer.command`
  (`bunx nx run website:serve`) was repointed at `bunx turbo run serve --filter=website`.
- `packages/e2e/{isc-legacy-package,isc-package,mit-package,no-license-package,unlicensed-package,
uses-isc-package}/**` each carried their own `project.json` (using `@nx/js:tsc` for `build`,
  unrelated to license-cop's own `@nx/js:swc`) that the plan never mentions. These are the source for
  a handful of tiny fixture packages (`@license-cop/mit-test-package` etc.), already published to the
  real npm registry and consumed by the `e2e/npm/**`/`e2e/yarn-*/**` fixtures via ordinary version
  ranges — nothing in this repo imports their TypeScript source directly except `uses-isc-package`
  importing `isc-test-package`. They weren't bun/npm workspace members (`packages/e2e/*` sits two
  levels below the `packages/*` glob), so that one cross-package import only worked at all via a
  `tsconfig.base.json` path alias reaching directly into `isc-package/src/index.ts` — a raw-source
  reference with no real package boundary. A first pass here deleted the dead `project.json` files and
  replaced each with a `package.json` `build` script built from raw `tsc` CLI flags
  (`--outDir`/`--rootDir` overrides fighting the `rootDir: "."` inherited from `tsconfig.base.json`),
  which needed an increasingly bespoke scratch-directory dance for `uses-isc-package` specifically once
  its cross-package import collided with a `--rootDir src` override (`error TS6059: ... is not under
'rootDir'`). **Corrected**, once it was clear the whole shape was fighting the grain of a normal
  workspace rather than embracing it: added `packages/e2e/*` to the root `workspaces` array, making
  these six real bun workspace members with real symlinked `node_modules`; dropped the now-redundant
  `tsconfig.base.json` path aliases for all six (the two remaining aliases, for `@license-cop/permissive`
  and `@license-cop/license-cop-e2e`, are for packages that are already real workspace members resolved
  normally, untouched here as out of scope); and gave every one of the six the exact same `tsdown`
  bundled-entry `build` script as `packages/license-cop` (`entry: ["src/index.ts"]`, `fixedExtension:
false`), replacing the raw `tsc` invocation entirely. `uses-isc-package` needed no special case at
  all once this landed: bun auto-links a workspace member by package name whenever a `dependencies`
  range is satisfiable locally — confirmed empirically, since its existing `"latest"` range (not
  `"workspace:*"`, which would itself be invalid once actually published) was already enough for bun
  to symlink the local `isc-package` workspace member — and tsdown's bundler resolves that import
  through the symlink and inlines it, so the rootDir conflict a raw-`tsc`, path-alias-based compile
  used to hit doesn't arise in the first place. Every one of the six now has the identical `build`
  (`tsdown`) and `lint` (`eslint . --max-warnings 0`) scripts, `"files": ["dist"]`, and `"main"`/
  `"types"` pointing at `./dist/index.js`/`./dist/index.d.ts` — none are wired into the root
  `turbo.json` pipeline (turbo only orchestrates declared workspace tasks the same way it always did;
  nothing currently invokes these six as part of `turbo run build` etc., matching the state before this
  milestone), but each is buildable and lintable standalone (`cd packages/e2e/<name> && bun run
build`/`bun run lint`), restoring exactly the capability their `project.json` targets provided —
  properly this time, as ordinary workspace members rather than raw-source path hacks.
- Adding a `typecheck` script is new functionality for every package here (nx never had a `typecheck`
  target for anything in this repo), not a preserved precedent — for `packages/license-cop`,
  `packages/permissive`, `packages/license-cop-e2e`, and `apps/website-e2e` this was a straightforward
  `tsc -b`/`tsc --noEmit`, but wiring it up for `apps/website` surfaced 16 genuine, pre-existing type
  errors (`astro.config.ts`'s `moduleResolution` setting rejecting `astro`/`@astrojs/*`'s package
  exports, `plugins/admonitions.ts`'s hast `ElementData` property access, a missing `shiki` type, and
  a `third-party.astro` layout prop mismatch) once `astro check` actually looked at the app for the
  first time. Fixing pre-existing Astro type debt is out of scope for an nx→turbo swap — same
  reasoning 1.7 already applies to Astro _linting_ being split out as new functionality rather than a
  preserved precedent. Left `apps/website` without a `typecheck` script for now (dropped the
  `@astrojs/check` devDependency that would have backed it) rather than either shipping a script that
  fails or quietly fixing unrelated content bugs; a future milestone can pick this up the same way 1.7
  will for linting.

- `website-e2e` had no ordering against the website build, so a top-level `turbo run build e2e` ran
  `website#build` and the Playwright suite at the same time. Playwright's `webServer` also runs its own
  nested `turbo run serve --filter=website` (which builds and then runs `astro preview`), and
  `astro build` empties `dist/` before rewriting it while `astro preview` serves straight from disk — so
  any rebuild that overlaps a test run turns pages into 404s. Seen once in a full forced run under load
  (5 of 330 chromium tests, "404: Not Found / Path: /docs"), then reproduced on demand by rebuilding
  the site partway through a run (4 failures, same signature). Fixed the same way `license-cop-e2e`
  handles the CLI build: `apps/website-e2e/turbo.json` declares `"e2e": { "dependsOn": ["website#build"] }`,
  which turbo honours even under `--filter=website-e2e` (the nested build is then a cache hit).

### 1.6 GitHub workflows ✅ done

Current workflows (`ci.yml`, `cd.yml`, `nx.yml`, `website.yml`, `codeql.yml`) route through the
external `tobysmith568/actions` reusable workflows/composite actions. Move to self-contained local
composite actions instead (`.github/actions/setup` for the install/cache step, `.github/actions/
test-cli` for the CLI's own behavioural smoke tests) plus `workflow_call` reusable workflows for
CodeQL and Pages, so the workflow graph no longer depends on an external repo. Concretely:

- [x] Add `.github/actions/setup/action.yml`: install bun (`oven-sh/setup-bun`), cache
      `~/.bun/install/cache` keyed on `bun.lock`, `bun install --frozen-lockfile`. Replaces every
      `tobysmith568/actions/.github/actions/checkout-pnpm-project@main` step.
- [x] Fold `ci.yml` into one `integration.yml` triggered on `pull_request` + `push: main`, with
      `format` / `lint` / `typecheck` / `build` / `test` as separate parallel jobs — each failing
      with a precise name instead of one monolithic `lint` job that also runs Prettier.
- [x] license-cop's own `e2e` job is more than an install-smoke-test would be: it's core product
      verification, matrixed over npm/yarn-classic/yarn-modern/pnpm × Node 20/22/24 ×
      Ubuntu/macOS/Windows, asserting the scanning logic against real installs of every supported
      package manager. Keep that matrix's _intent_ untouched; only modernize its mechanics
      (bun-based setup, turbo-invoked). Add a `bun` leg once Part 3 (bun.lock support) lands.
- [x] `local-licenses` / `published-licenses` jobs (license-cop dogfooding itself against its own
      dependencies) are worth keeping as-is — just re-point them at the turbo-built `dist/` output
      and `bunx license-cop`.
- [x] `cd.yml` → a `deployment.yml` on `workflow_dispatch`: bump version → run integration → publish
      to npm (with `id-token: write` for provenance) → create the GitHub release → redeploy the docs
      site. The `purge-jsdelivr` step (for `@license-cop/permissive`) stays, slotted in after
      publish.
- [x] `website.yml` → `pages.yml`: build → `configure-pages` → upload → `deploy-pages` (mostly
      already similar; mainly swap `pnpm nx run website:build` for `bunx turbo run build --filter=website`).
- [x] `codeql.yml` → make it a `workflow_call`-able reusable workflow, called from both a `schedule`
      trigger and from `integration.yml`, instead of the current standalone scheduled+push+PR
      triggered copy — avoids running CodeQL twice on every PR.
- [x] Delete `nx.yml` entirely (see 1.5).
- [x] Pin action versions to their current latest majors (`actions/checkout@v7`,
      `actions/upload-artifact@v7`/`download-artifact@v8`, `github/codeql-action/*@v4`,
      `actions/configure-pages@v6`, `actions/deploy-pages@v5`) rather than license-cop's current
      older pins.

**Found during implementation, not in the original plan:**

- Post-1.5, `package.json` lives in the package directory rather than being copied into `dist/` (see
  1.5's own dist-root correction), so `deployment.yml`'s `publish` and `create-release` jobs each
  need their own `Set Version` step (re-running `bun run --filter=... version` against their own
  fresh checkout) before packing/publishing — the version bump made in `integration.yml`'s `build`
  job doesn't travel with the downloaded `build` artifact, which only contains `dist/` output, not
  `package.json`. The old `cd.yml` never had this problem because nx's pre-1.5 dist-`package.json`
  generation copied a version-stamped `package.json` into `dist/` at build time; that mechanism is
  gone (correctly, per 1.5), so this step has to be added explicitly now rather than ported forward.
- `cd.yml`'s checkout steps referenced `${{ inputs.branch_name }}`, but `cd.yml`'s own
  `workflow_dispatch` never declared a `branch_name` input (only `version`) — a latent no-op left
  over from `ci.yml`'s `workflow_call` input of the same name. Dropped entirely rather than ported;
  every job now just checks out the ref that triggered the workflow, which was the only value
  `branch_name` could ever actually have resolved to.
- Old workflows set `defaults.run.shell: pwsh` repo-wide, load-bearing only for one step
  (`purge-jsdelivr`'s `Invoke-WebRequest`) — everything else was a plain executable invocation that
  runs identically under `pwsh` or each OS's native shell. Dropped the repo-wide `pwsh` default and
  rewrote `purge-jsdelivr` as `curl -fsSL`, so Ubuntu/macOS jobs (including the whole `e2e` matrix)
  use their native `bash` instead of an added, otherwise-unneeded `pwsh` dependency.
- `.github/actions/setup` grew a `registry-url` input (unused by default, passed only by
  `deployment.yml`'s `publish` job) to get `actions/setup-node` to write an `.npmrc` pointing at the
  npm registry with `NODE_AUTH_TOKEN` — the old workflow's npm auth was presumably handled inside the
  external `checkout-pnpm-project` composite action, which isn't visible from this repo, so this had
  to be reconstructed rather than ported.
- `.github/actions/test-cli` ended up doing more than a single license check: `--version` and
  `--help` invocations were added ahead of the real license check, so "behavioural smoke tests"
  (plural, per this section's own intro) actually exercises more than one code path rather than just
  the default command.
- `local-licenses`'s CLI invocation changed shape, not just path: `node ./dist/packages/license-cop/src/bin/license-cop` (nx's centralized dist root) becomes `node ./packages/license-cop/dist/bin.js` (tsdown's bundled entry point, per 1.5's dist-root correction).
- `local-licenses` and `e2e` both need a real `bun install` (via `.github/actions/setup`), not just
  the downloaded `dist/` artifact — `packages/license-cop`'s dependencies aren't bundled into
  `dist/bin.js` by tsdown (only workspace-internal imports are inlined), so `node_modules` has to be
  present at runtime the same way it was under the old nx/nvm setup.
- Every workflow step now invokes `bunx turbo run <task>` directly instead of the root
  `package.json`'s forwarding scripts (`bun run lint`/`build`/`test`/`typecheck`) — those root
  scripts exist for a human typing at a terminal, and pipelines should say precisely which task
  they're asking turbo for rather than going through that indirection. This meant giving `version`,
  `pack`, and `publish` (release-only, previously invoked as `bun run --filter=... <script>`,
  bypassing turbo entirely) their own entries in `turbo.json` — each `"cache": false` (like `e2e`,
  they're side-effecting: a version bump, a registry publish) with an explicit `env` allowlist
  (`VERSION` for `version`; `NODE_AUTH_TOKEN`/`NPM_TAG` for `publish`), since turbo strips
  environment variables from a task's execution unless the task declares it needs them — confirmed
  empirically: `bunx turbo run version` silently ran `bun pm pkg set version=` with `VERSION` missing
  until the `env` entry was added. `version`/`pack`/`publish` are invoked with no `--filter` at all —
  confirmed empirically that turbo scopes to every workspace package by default and just skips the
  ones (`license-cop-e2e`, `website`, the `packages/e2e/*` fixtures, …) that don't declare the task
  in their own `package.json`, so naming `license-cop`/`@license-cop/permissive` explicitly would
  have been redundant. `e2e` keeps its `--filter` (`license-cop-e2e` or `website-e2e`) because, unlike
  those three, _both_ packages that matter here declare an `e2e` script, and each CI job wants only
  one of them.
- Same reasoning applied to `integration.yml`'s `build` job's `Upload Build` step: its own `Build`
  step runs unfiltered (`bunx turbo run build`), so hardcoding `packages/license-cop/dist` +
  `apps/website/dist` as the upload path was the same kind of target-naming the rest of this section
  argues against. Changed to `apps/**/dist` + `packages/**/dist`, scoped to the workspace's own glob
  shape (mirroring root `package.json`'s `workspaces` entries) rather than a bare `**/dist` — plus a
  `!**/node_modules/**` exclusion, which turned out to still be required even with that scoping: bun's
  isolated linker (1.1) plants a real symlink one level inside each package's own `node_modules` for
  every direct dependency (e.g. `packages/license-cop/node_modules/axios ->
../../../node_modules/.bun/axios@1.20.0/node_modules/axios`), and `actions/upload-artifact` follows
  symlinks by default — confirmed several of `packages/license-cop`'s direct dependencies
  (`axios`, `cosmiconfig`, `json5`, `deepmerge`) ship their own `dist/`, so without the exclusion even
  the narrower `packages/**/dist` glob would walk straight through those symlinks and pick up
  dependency internals, not just this repo's own build output. Separately confirmed (via a clean
  `rm -rf`-then-rebuild) that an unfiltered `turbo run build` currently produces eight `dist/`
  directories, not two: `packages/license-cop/dist`, `apps/website/dist`, and one per `packages/e2e/*`
  fixture (all six declare the same tsdown `build` script per 1.5's workspace-member correction) —
  `packages/permissive` has no `build` script and produces none. The six fixture `dist/`s riding along
  in the `build` artifact is a real, accepted side effect of not hardcoding paths, not an oversight —
  none of them are large, and no downstream job (`local-licenses`, `e2e`, `e2e-website`) reads them,
  so they're just unused bytes in the uploaded artifact rather than anything that changes behavior.
- `deployment.yml`'s `publish` job originally carried a `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`
  env var on the `Publish` step, an assumption ported from the old `cd.yml` without checking whether
  it still matched how this account actually publishes. It doesn't: modeled the `publish` job on the
  sibling `gramdown` repo's `deployment.yml`/`turbo.json` instead, which publishes via npm's newer
  OIDC "trusted publishing" — no npm token at all. Two things had to line up for this to work:
  1. `npm` itself needs upgrading before publish — OIDC trusted-publishing support only landed in a
     recent `npm` CLI version, newer than what ships with Node 24 today — hence the
     `npm install --global npm@latest` step added right before `Publish`, matching gramdown's own
     "Upgrade npm for trusted publishing" step.
  2. turbo strips env vars from a task's execution by default (see this section's earlier note on
     `VERSION`), and OIDC's actual credential isn't a static secret at all — GitHub Actions injects a
     short-lived `ACTIONS_ID_TOKEN_REQUEST_URL`/`ACTIONS_ID_TOKEN_REQUEST_TOKEN` pair into the job's
     environment whenever `permissions.id-token: write` is set (already true for this job), and `npm
publish` reads those itself to negotiate the registry token. `turbo.json`'s `publish` task needed
     both names added, or `bunx turbo run publish` would strip them before `npm publish` ever saw
     them, the same way it silently dropped `VERSION` earlier in this section. Also switched `publish`
     and `version` from `env` to `passThroughEnv` (mirroring gramdown) — `env` bakes the variable's
     value into the task's cache hash, which is the wrong semantics for a token that's different on
     every single run by design; `passThroughEnv` passes the value through without hashing it. Both
     tasks are already `cache: false`, so this is a correctness-of-intent fix rather than one with an
     observable effect today.

### 1.7 Add Astro linting ✅ done

New functionality, not a preserved precedent — split out from 1.2 (see that section's correction
note) once it became clear `apps/website` isn't linted at all today. Done last within Part 1 so it
lands on top of the already-migrated flat config (1.2) and the already-migrated turborepo scripts
(1.5) rather than needing its own bridge step through Nx.

- [x] Add `eslint-plugin-astro` and `astro-eslint-parser` (the plugin's own recommended parser for
      `.astro` files) as devDependencies.
- [x] Extend the root `eslint.config.mjs` (from 1.2) with the plugin's flat `recommended` config,
      scoped to `apps/website/**/*.astro` — this repo's flat config is a single root file with
      glob-scoped overrides per package (see 1.2), so this is one more scoped block, not a new file.
- [x] Give `apps/website` a `lint` script in its `package.json` (added alongside the rest of its
      turborepo scripts in 1.5) and wire it into `turbo.json`'s `lint` pipeline / the root
      `bun run lint`.
- [x] Run it against the existing `.astro` files under `apps/website/src` and fix whatever the
      first real pass surfaces — there's no prior baseline to diff against, so expect some genuine
      findings rather than pure config churn.

  **Done.** Added `eslint-plugin-astro`, `astro-eslint-parser` and `@typescript-eslint/parser` as devDependencies. The plugin's `flat/recommended` config is scoped to `apps/website/**/*.astro` in the root `eslint.config.mjs`, with `@typescript-eslint/parser` set as the frontmatter parser (the plugin's default can't parse the TS in `interface`/typed-destructuring frontmatter). `.astro/**` is now ignored, and `apps/website` has a `lint` script picked up by `turbo run lint`. First pass: all `.astro` files were clean once parsed; the only real findings were an `any` in `plugins/admonitions.ts` and the generated triple-slash reference in `src/env.d.ts`, both silenced with a justified `eslint-disable-next-line`.

## Part 2 — Functional changes

Breaking changes are in scope here — this is a major version bump, not a patch. The two big moves
(splitting out `@license-cop/core` and reshaping the CLI's public flags) both touch the CLI shell
at the same time, which is why this is one big-bang branch rather than several: doing them
separately would mean moving `lib/cli/**` twice.

### 2.1 Split out `@license-cop/core` ✅ done

Today `packages/license-cop` is both the library (`src/index.ts` exports `checkLicenses`,
`LicenseCopOptions`, and the `result.ts` types — consumable by other code, e.g. anything scripting
against license-cop programmatically) and the CLI (`src/bin/license-cop`, `src/lib/cli/**`) in one
package. Split it the way a library-plus-CLI npm package generally benefits from splitting: a pure
engine package with no CLI concerns, and a thin CLI package that depends on it via `workspace:*`.

- [x] New `packages/core`, npm name `@license-cop/core` (matches the existing `@license-cop/permissive`
      scoping). Move `lib/license-cop.ts`, `lib/result.ts`, `lib/config/**`, `lib/dependency/**`,
      `lib/dependency-scanning/**`, and `lib/spdx/**` into it wholesale — these modules are already
      options-in/data-out with no CLI dependency, so this is a move, not a rewrite.
  - `src/index.ts` becomes the entire public export surface: `checkLicenses`, `LicenseCopOptions`,
    and the result types — i.e. today's `packages/license-cop/src/index.ts`, relocated. Once it's
    the _only_ place these are exported from, the current hack (importing `Command` from
    `commander` purely so `@nx/dependency-checks` doesn't prune the dependency) has nothing left to
    guard — it's already moot once nx is gone (1.5) and commander is dropped (2.2), so just delete
    it rather than port it.
- [x] Rename `packages/license-cop` → `packages/cli` to make the split visually obvious; its
      `package.json` `"name"` stays `license-cop` (unscoped, matching the bin name — the package a
      user runs should be named after what they type to invoke it, not after a scoped library). It
      keeps only `src/bin.ts` and `src/lib/cli/**` (see 2.2) plus a `"@license-cop/core":
"workspace:*"` dependency; it has no `"main"`/`"exports"` of its own — it's bin-only.
- [x] Update every path that currently assumes `packages/license-cop`: the CI `local-licenses` job
      (`node ./dist/packages/license-cop/src/bin/license-cop`, see 1.6), `packages/license-cop-e2e`'s
      spawn target in `helpers.ts`, and any `tsconfig`/workspace references.
- [x] `packages/license-cop`'s current `dependencies` split roughly in two: `@npmcli/arborist`,
      `@pnpm/reviewing.dependencies-hierarchy`, `axios`, `compare-versions`, `cosmiconfig`,
      `deepmerge`, `git-filesystem`, `json5`, and the domain-validation half of `zod`'s usage move to
      `@license-cop/core`'s `package.json`; the CLI package's own dependencies shrink to `zod` (for
      arg-schema validation, see 2.2) plus `@license-cop/core` — `commander` and
      `@commander-js/extra-typings` are dropped outright, not moved (see 2.2).
- [x] _(Done in 2.5, which reshaped that package anyway.)_ Consider whether `packages/license-cop-e2e` should be renamed alongside (`cli-e2e`?) for
      consistency — cosmetic, not required.

**Found during implementation, not in the original plan:**

- `lib/logger.ts` couldn't simply move with the engine: engine code calls `logger.verbose(...)` in ~10 places, and the CLI needs the same singleton for its own output. Instead of exporting the singleton from core, core's `LicenseCopOptions` gained an optional `onVerbose?: (message: string) => void` (default no-op, so library use stays silent, exactly as before) threaded through the scanners, `loadConfig`/`loadParentConfig`/`parent-resolutions/*`, `readPackageJson` and `getPackageManager`. The CLI keeps its own `lib/logger.ts` for `log`/`error` and passes `logger.verbose` as `onVerbose`. This is the only place 2.1 wasn't a pure move; 2.2 deletes the CLI's copy along with the singleton.
- Core's public surface is `checkLicenses`, `LicenseCopOptions`, the result types, plus `loadConfig`, `ConfigError`, `readPackageJson` and the `OnVerbose` type — the CLI genuinely needs the config/package.json helpers, so these are deliberate exports rather than the temporary ones the plan first assumed.
- `npm exec` can't resolve the CLI's `workspace:*` dependency on core, so `license-cop-e2e/helpers.ts` now spawns `node packages/cli/dist/bin.js` directly (bun's workspace `node_modules` links core by symlink) instead of `npm exec ../../../packages/license-cop`.
- `packages/cli` has no spec files once the engine specs move (all existing specs are engine code), and `bun test` exits 1 on "No tests found", which failed `turbo run test`. Dropped the CLI's `test` script for now; 2.2 re-adds it alongside the first CLI specs.
- Root `package.json`'s stale nx-era `dependencies` block was trimmed to what `apps/website` actually imports (`@primer/octicons`, `hastscript`, plus `tslib`, which nothing imports but which was left alone as out of scope). `@pnpm/logger`, an unmet peer of `@pnpm/reviewing.dependencies-hierarchy` that only the root used to provide, is now an explicit dependency of core.
- `turbo.json`'s `publish` task gained `dependsOn: ["^publish"]` so `@license-cop/core` reaches the registry before the CLI that pins it. Confirmed with `bun pm pack` that `workspace:*` is rewritten to a real version in the CLI tarball.
- **Still to do outside the repo:** configure an npm trusted publisher for `@license-cop/core` (workflow `deployment.yml`) before the first release.
- **Pre-existing, found while baselining and not fixed here:** `license-cop -v`, `--version` and `version` all fail today (`unknown option`/`too many arguments`) — the fake `-v` subcommand never worked — and `.github/actions/test-cli` runs `--version`, so it would fail in CI. Running the CLI against this repo's own workspace also crashes on bun's `node_modules/.bun` directory. Both are out of scope for 2.1; the version command is rebuilt in 2.2/2.3. The stale `../../../dist/packages/license-cop` entries in `e2e/npm/**/package-lock.json` are likewise leftovers from before 1.5.

### 2.2 CLI architecture: an `Io` seam instead of a singleton ✅ done

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

| Current                                                                                                                         | New                                                                                                                                 | Notes                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/bin/license-cop` (`require("../lib/cli").main(...)`)                                                                       | `src/bin.ts`                                                                                                                        | Thin `process` glue only — parse, exit, top-level catch. ESM instead of a CJS shim.                                                                                                                                                                                                                          |
| `lib/cli/index.ts` (`main(args)`, calls `logger.enableLogging()`, `program.parseAsync`)                                         | `src/main.ts` (`run(argv, io): Promise<number>`)                                                                                    | Returns an exit code instead of mutating `process.exitCode`; takes `io` as a parameter (defaulting to `defaultIo`) instead of a singleton.                                                                                                                                                                   |
| `@commander-js/extra-typings` command tree (`create-command.ts`, `commands/main.ts`, `commands/init.ts`, `commands/version.ts`) | `src/args/schema.ts` + `src/args/parse.ts`                                                                                          | `parseArgs` (`node:util`) tokenizes; `zod` validates into a `CliInvocation` discriminated union. Drops the `commander`/`@commander-js/extra-typings` dependency entirely. What the invocation kinds actually are changes slightly here — see 2.3.                                                            |
| _(new)_                                                                                                                         | `src/errors.ts`: a `UsageError` class                                                                                               | Thrown by `args/parse.ts` when the command line itself is wrong (an unknown flag, a missing value) — distinct from failures that happen _after_ a valid command line (a missing config file, a `ConfigError`), which the relevant command handler reports itself since a usage reminder wouldn't help there. |
| `commands/main.ts`'s inline `runLicenseCop`                                                                                     | `src/commands/check.ts` (`runCheck(options, io)`)                                                                                   | Takes validated options + `io`, returns an exit code, calls the existing `checkLicenses` from `@license-cop/core` unchanged.                                                                                                                                                                                 |
| `commands/init.ts`'s `initCommandAction`                                                                                        | `src/commands/init.ts` (`runInit(options, io)`)                                                                                     | Same pattern — currently calls `logger.log`/`writeFile` directly; route both through `io`.                                                                                                                                                                                                                   |
| `commands/version.ts`                                                                                                           | folded into `src/help.ts` (`versionText()`) + a `"version"` `CliInvocation` case in `main.ts`                                       | version/help are data, not commands with their own action bodies.                                                                                                                                                                                                                                            |
| `report-failure.ts` / `report-success.ts`                                                                                       | same files, signature becomes `(result, io)`                                                                                        | Currently import the `logger` singleton directly — the only change needed is threading `io` through instead.                                                                                                                                                                                                 |
| `lib/logger.ts` (singleton, `enableLogging`/`enableVerboseLogging` mutable state)                                               | `src/io.ts` (`Io` interface: `stdout`, `stderr`, verbosity as an explicit field on the invocation/options rather than global state) | The behavioral piece worth keeping — verbose vs. normal output — moves from "a flag that mutates a singleton before anything runs" to "a value threaded through like every other option."                                                                                                                    |
| `ConfigError` (from `@license-cop/core` post-2.1)                                                                               | unchanged, but caught in `run()` alongside the new `UsageError`                                                                     | Currently caught deep inside `commands/main.ts`'s `.action()`; moving the catch up to `run()` means every entry point (not just the default command) benefits, and both error kinds get the same "print message, set exit code" treatment.                                                                   |

**Done**. `packages/cli/src` is now `bin.ts`, `main.ts`, `io.ts`, `errors.ts`, `help.ts`, `args/{schema,parse}.ts`, `commands/{check,init}.ts` and `report-{failure,success}.ts`; `lib/cli/**`, the CLI's copy of the logger singleton and both commander dependencies are gone, and `zod` is back as a CLI dependency for the invocation schema. Flags were ported exactly as they were (2.3 changes them), and the e2e suite is unchanged at 42 pass / 18 fail (the 18 yarn unhappy paths, since `yarn` isn't installed here).

**Found during implementation, not in the original plan:**

- `run(args, io, cwd)` takes the already-sliced user arguments (`process.argv.slice(2)`, done in `bin.ts`) rather than the full `process.argv` the table implied — easier to call from tests — and takes the default directory as a parameter instead of reading `process.cwd()` at import time.
- Verbosity is `createVerboseLogger(io, enabled)` in `io.ts`: it returns a no-op when disabled, and when enabled writes the same "Verbose logging enabled" line the old logger printed, then hands back the `(message) => void` that's also passed to core as `onVerbose`. Each command builds its own from `options.verbose`, so `run` doesn't need to know about verbosity at all.
- `-v`/`--version` finally works: it was a fake subcommand named `-v` under commander and never resolved (see 2.1's notes). It's now an ordinary `version` invocation reading the CLI's own `package.json`, and `.github/actions/test-cli`'s `--version` step should pass for the first time.
- `--include-dev`/`--dev-only` on `init` (or `--init`) is a usage error, matching commander's old "unknown option" behaviour for options not declared on a subcommand.
- Node's `parseArgs` error messages are more verbose than commander's ("...To specify a positional argument starting with a '-'..."). They're passed through as-is inside a `UsageError`; worth trimming if it looks noisy in the release notes.
- New specs: `args/parse.spec.ts` (every flag and every usage-error case) and `main.spec.ts` (`run` with a fake `Io`: help, version, usage error, `init`, verbose on/off, and real check runs against a temp project for the success, forbidden-license and missing-config exit codes). This is a slice of 2.5's untested-CLI item and gives the CLI its `test` script back. One trap while writing them: arborist only reports `node_modules` entries the project's `package.json` actually declares, so an undeclared fixture dependency makes every check trivially "pass".

### 2.3 Neaten the CLI flags (breaking changes allowed) ✅ done

With commander gone and the invocation shape being rebuilt from scratch anyway (2.2), this is the
window to fix flag oddities that exist today mostly as artifacts of how commander was being used
rather than deliberate design. Worth deciding on explicitly rather than porting as-is:

- [x] `-v`/`--version` is currently a fake "subcommand" (`versionCommand`, `.name("-v")`) — a
      commander idiom for faking a global flag as a command. Under `parseArgs` + `zod` this is just
      a normal `CliInvocation` case; the workaround disappears on its own, but it's worth
      re-checking the flag names read well outside of that constraint.
- [x] `--init` exists twice: as its own `init` subcommand _and_ as a top-level `--init` boolean flag
      on the main command that's a pure alias for the same action
      (`if (options.init) { await initCommandAction(...); return; }`). Decide whether the alias
      pulls its weight or whether one form should go.
- [x] `-D, --include-dev` and `--dev-only` are two independent booleans covering overlapping
      ground (dev-in-addition-to-prod vs. dev-instead-of-prod). A single flag with a mode — e.g.
      `--dev-dependencies <include|only>`, defaulting to prod-only — would make the illegal
      "both true" combination unrepresentable instead of needing to be reasoned about at the call
      site.
- [x] `--verbose` and `-d/--directory` are bolted onto every subcommand today via
      `create-command.ts`'s shared builder. Confirm both are actually meaningful on `init` (a
      directory, clearly yes; verbose logging for a single `writeFile`, less obviously) rather than
      just inherited because the builder was shared.
- [x] Whatever the final flag set, update `lib/cli/commands/init.ts`'s generated `.licenses.json`
      template and the `--help` text together, and make sure `packages/license-cop-e2e`'s fixtures
      (`e2e/**/package.json` + `.licenses.json` pairs) still reflect real invocations of the CLI —
      several of those directories are named after the exact flag behaviour being asserted (e.g.
      `should-fail-when-a-package-is-specified-with-a-caret`), so a flag rename needs a pass over
      those too.

**Done.** Decisions, made one flag at a time:

- `-v`/`--version` keep their names; nothing to change once it's an ordinary invocation (it now actually works — see 2.2's notes).
- **`--init` flag removed**, `init` subcommand kept. Breaking for anyone scripting `license-cop --init`.
- **`-D, --include-dev` and `--dev-only` replaced by `--dev-dependencies <include|only>`** (default: production dependencies only). `LicenseCopOptions` (two booleans) and the `.licenses.json` keys `includeDevDependencies`/`devDependenciesOnly` are unchanged; the CLI flag is mapped onto them in `commands/check.ts`, and the config keys still apply when the flag is absent, exactly as before.
- **`--verbose` stays accepted on `init`** — harmless, and every command keeps taking the same global flags.

**Found during implementation, not in the original plan:**

- The three removed flags don't fall through to Node's generic "Unknown option" error: `parse.ts` checks for them first and says what to use instead (`error: the --init flag has been removed, use 'license-cop init' instead`), since a bare "unknown option" is a poor migration experience for a scripted CI step.
- `--dev-dependencies` is validated by hand (`include`/`only`) before the zod schema, whose internal value set also includes `exclude` (the default). Otherwise a bad value produced a zod-flavoured message listing `exclude` and an internal field name.
- The README, the copy in `packages/cli`, `apps/website/src/pages/docs.md` and the landing page's "get started" line all told people to use "the `--init` flag"; they now say the `init` command. None of the docs ever mentioned `-D`/`--dev-only` (only the config keys), so no other doc changes were needed and the new flag is still undocumented on the site — worth a docs pass separately.
- No `packages/license-cop-e2e` fixtures needed changing: the suite only ever passes `--verbose`, so it can't detect a flag rename. The new flag behaviour is covered by `args/parse.spec.ts` and `main.spec.ts` (real check runs against a temp project with a forbidden dev dependency, for default/`include`/`only`).

### 2.4 Extract a shared classifier out of the per-engine duplication ✅ done

`lib/dependency-scanning/npm.ts` and `pnpm.ts` don't just duplicate structure — they duplicate the
actual license-classification logic (allow-list check → license-expression parsing →
`calculateIssues` → bucket into allowed/no-license/forbidden), and the code already flags this
itself:

```ts
// This function is very similar to the one in pnpm.ts
// If you change this, you probably want to change that one too
```

This is _why_ the e2e fixture matrix is the only place that classification logic gets tested today
— there's no single place to unit-test "does license X get classified correctly" independent of an
engine, because that logic doesn't currently exist independent of an engine. Fixing this is a
prerequisite for 2.5, not just a nice-to-have refactor:

- [x] Extract the shared part — given a normalized `{ name, version, packageJson, children }` node
      plus the resolved config (allowed licenses/packages, dev-dependency filtering), decide which
      bucket it falls into and recurse — into one function both engines call. Each engine's own
      code shrinks to just "walk my package manager's native tree shape and hand normalized nodes
      to the shared classifier."
- [x] **Watch for one real behavioral difference while merging these:** `npm.ts` filters
      dev-dependencies per-node inside `parseNode` (checking `node.dev`), while `pnpm.ts` filters
      them upstream via `buildDependenciesTree`'s `include: { dependencies, devDependencies,
optionalDependencies }` option. Both need to keep working the same way from the caller's
      perspective, so pin this down with a test _before_ extracting, not after.
- [x] Once extracted, this is exactly what unlocks 2.5's bottom tier: the classifier can be unit
      tested directly against hand-built normalized nodes, with zero package manager and zero
      install involved.

### 2.5 Restructure the e2e suite around a test pyramid ✅ done

Today's `e2e/{npm,pnpm,yarn-classic,yarn-modern-with-node-modules}/**` fixture set is one directory
per (scenario × package manager) pair — roughly 10 scenarios × 4 package managers, each a full
`package.json` + lockfile (+, for both yarn variants, a `.yarnrc.yml` and a committed
`.yarn/releases/*.cjs` binary). Adding bun as a 5th package manager the same way (Part 3) would push
that past 50 near-identical directories. Two axes are being conflated here that don't need to be:
_which scenario_ (package-manager-agnostic — this is what 2.4's classifier decides) and _which
package manager_ (how you get from disk to a normalized tree at all). Worse, `npm` and both `yarn`
variants already run through the identical `npmDependencyScanning` path today (`lib/license-cop.ts`
only special-cases `pnpm`; everything else falls through to the npm engine) — so yarn's ~20
directories are currently just re-confirming a code path npm's fixtures already exercise.

Restructure into three tiers instead:

- [x] **Unit: the classifier (2.4), tested once, package-manager-agnostic.** Every scenario
      currently expressed as an `e2e/<pm>/should-*` directory — missing license, forbidden license,
      semver ranges, the legacy `licenses` field, allowed packages, dev-dependency filtering — moves
      to a spec file that builds a small in-memory node tree and asserts the resulting
      `CheckLicensesResult` bucket. No install, no filesystem fixtures, no package manager.
- [x] **Contract tests per engine, one or two real fixtures each.** For each engine that's
      genuinely distinct (npm, pnpm, and whatever bun turns out to need per Part 3's open question),
      keep a minimal real install — "simple deps" and "nested/transitive deps" is likely enough —
      asserting the engine correctly walks its package manager's native tree into normalized nodes
      (names, versions, license fields, dev/prod flags) and correctly applies dev-dependency
      filtering per the caveat in 2.4. This is _not_ re-testing classification, just "does this
      engine read this package manager's on-disk state correctly."
- [x] **Collapse `e2e/yarn-classic/**` and `e2e/yarn-modern-with-node-modules/**`** from ~10
      scenario directories each down to one or two confirming fixtures, since they exercise the
      same `npmDependencyScanning` path as `e2e/npm/**` and gain nothing from the full scenario
      matrix once 2.4/2.5's unit tier covers scenarios directly.
- [x] **A handful of true smoke tests: the built CLI binary, one real install, seams only.** Args
      parsed → engine invoked → report printed → exit code — confirming the pieces wire together,
      not re-verifying every classification edge case again. `packages/license-cop-e2e` shrinks to
      this tier.
- [x] Everything else currently untested stays on the list regardless of the above: `lib/cli/**`
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

**Found during implementation, not in the original plan:**

- The yarn fixtures aren't just redundant coverage of the npm engine — they're what justifies _not_ special-casing yarn, so they stay (as real installs), but not with the full scenario matrix. Most "scenarios" turned out to be pure logic that never touches a package manager: caret/tilde/semver range is `isAllowedPackage`, the legacy `licenses` field is `getLicenseExpression`, and missing/no/unlicensed license and missing package are classifier buckets. Those all live in the unit tier (`package-rules.spec.ts` gained the failing-range/caret/tilde cases). What only a package manager can decide is how it lays out `node_modules`/its lockfile: names, versions, the transitive walk, and the dev/prod split.
- The per-scenario fixture directories are replaced by `packages/cli-e2e/src/lib/contract.spec.ts` — one project (`uses-isc` → `isc` transitively, plus `mit` as a dev dependency) installed fresh with each of npm, pnpm, yarn 1, yarn 3 and yarn 4, asserting `checkLicenses`' result for the default / include / only dev-dependency modes — and `cli.spec.ts`, now a couple of smoke tests of the built CLI (npm and pnpm, the two distinct engines).
- Projects are written into a temp dir by `PackageJsonBuilder`/`LicenseFileBuilder` (`createProject` in `project.ts`) and installed by the real package manager; `KEEP_TEMP=1` leaves the directory behind. No lockfiles or `node_modules` are committed any more, and no test hits the registry: `packages/e2e/{isc,mit,uses-isc}-package` each have a turbo-cached `pack-fixture` task (`bun pm pack --destination tarballs`) that `cli-e2e#e2e` depends on, and the projects depend on those tarballs via `file:`. A committed lockfile pointing at a tarball would record its integrity hash and break on any rebuild, hence no lockfiles. `uses-isc`'s own dependency on `isc` is redirected to the local tarball with each package manager's override spelling (`overrides` / `pnpm.overrides` / `resolutions`), spiked and confirmed working for npm, pnpm, yarn 1 and yarn 3, and then yarn 4. The yarn releases (1.22.22, 3.8.7 and 4.18.0 — yarn 1 and 4 added here alongside the existing 3.8.7) live once in `packages/cli-e2e/yarn-releases` instead of once per fixture, and each is run straight with `node <release> install`, so no yarn needs to be installed or on PATH and the version under test is pinned in the repo. The `PackageManager` keys are now `yarn-1`, `yarn-3` and `yarn-4` (the berry ones write a `nodeLinker: node-modules` `.yarnrc.yml`).
- `no-license-package`, `unlicensed-package` and `isc-legacy-package` only fed scenarios that moved to the unit tier, so they're no longer needed. The old `e2e/` fixture tree is likewise gone. All of these are deleted, and `packages/license-cop-e2e` is renamed `packages/cli-e2e` (package name `cli-e2e`, matching `packages/cli`); the historical notes above still say `license-cop-e2e`.
- Not verified on Windows: the `file:` specifiers use forward-slash absolute paths, which should work on the Windows CI leg but hasn't been run there.
- The network-fetching `parent-resolutions/{github,http,npm}.ts` modules didn't need a DI seam after all: their specs replace `axios` with `mock.module`, which is enough for fast unit tests, so the "consider injecting the fetcher" suggestion in the last bullet above was not taken.
- The "collapse yarn" bullet above ended up going further than "one or two confirming fixtures": yarn's fixtures were replaced outright by the shared contract test, which runs against yarn 1, 3 and 4, so the yarn coverage that guards the "no yarn-specific code" decision is now a real install per major rather than a copy of the npm scenarios. See `docs/updating-package-managers.md` for how the committed releases are bumped.
- `packages/test-utils` (`@license-cop/test-utils`, private) is the one shared test helper: `createTempDir` (every temp dir the tests create, under one configurable root, kept with `KEEP_TEMP=1`) and `writeJson`. Core, the CLI and `cli-e2e` depend on it; it is a workspace package with no build step (its `main` is the TypeScript source).
- `mise.toml`/`mise.lock` (added only to put a yarn launcher on PATH for the old fixtures) are deleted: the suite runs each yarn straight from its committed release.

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

**Part 1 (one branch):**

1. **1.1** (pnpm → bun) — foundational and orthogonal to nx; every later step needs `bun` on the
   path anyway.
2. **1.2, 1.3, 1.4** (ESLint upgrade, Jest → bun:test, Cypress → Playwright) — each lands as its
   new tool wired up via an `nx:run-commands` bridge (see each section's first checklist item),
   verified independently through the _existing_ `pnpm nx run-many --target X` and existing CI.
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
    trimming `packages/cli-e2e` (formerly `license-cop-e2e`) down to seam-level smoke tests) rather than as one giant
    commit.

**Part 3 (a third branch, after Part 2 merges):**

11. **Part 3** (bun.lock support) — on its own, once `@license-cop/core`'s package-manager
    detection, scanning modules, and the 2.4/2.5 test pyramid have already settled from Part 2.

**Part 4 (a fourth branch, after Part 3 merges):**

12. **Part 4** (Yarn Plug'n'Play support) — after bun, because bun settles how a new package manager is added under the 2.4/2.5 pyramid, and because PnP is the first package manager that needs its own way of reading an install rather than reusing arborist or the pnpm hierarchy library.
