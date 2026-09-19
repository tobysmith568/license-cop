# Milestones 2.1–2.3 plan — core split, `Io` seam, flag cleanup

One shared plan for [migration.md](migration.md) §2.1, §2.2 and §2.3, since all three rework the same CLI shell and Part 2 already lands as a single branch. It runs as three phases of commits on that branch, each green and verifiable on its own, so nothing "temporary" ever ships and no interim scaffolding is needed (no throwaway logger export, no interim `version.ts` patch).

- **Phase A (2.1):** pure move — `@license-cop/core` + `packages/cli`. Behaviour identical; e2e unchanged. The reviewable, bisectable bit.
- **Phase B (2.2):** `Io` seam, `parseArgs` + `zod`, commander removed, core gets a logging hook. Flags ported _as they are today_, so the e2e suite proves the parser rewrite is behaviour-preserving.
- **Phase C (2.3):** flag changes on top of the new parser. Kept separate from B on purpose (see the note there) even though it's the same files.

2.4 (classifier extraction) and 2.5 (test pyramid) stay out of this plan; so does Part 3.

## Current state (verified)

- `packages/license-cop` is one package: library entry `src/index.ts`, CLI entry `src/bin.ts`, everything else under `src/lib/**`. tsdown builds `dist/index.js` + `dist/bin.js` (CJS, `dts: true`), `"files": ["dist"]`.
- The only CLI code is `lib/cli/**`: `index.ts`, `create-command.ts`, `commands/{main,init,version}.ts`, `report-failure.ts`, `report-success.ts`. Nothing outside it imports from it.
- `lib/logger.ts` is a module-level singleton (`loggerEnabled`/`verboseEnabled`) used by **both** halves: the CLI calls `log`/`error`/`enableLogging`/`enableVerboseLogging`; the engine calls only `logger.verbose(...)` — in `dependency-scanning/{npm,pnpm}.ts`, `dependency/package-json.ts`, `config/load-config.ts`, `config/parent-resolutions/{http,npm,github}.ts`.
- CLI state today: `main.ts` sets `process.exitCode` in the action and catches `ConfigError` inline; `report-success.ts` sets `process.exitCode = 0`; `create-command.ts` adds `--verbose` and `-d,--directory` to every command via a `preAction` hook that mutates the logger; `version.ts` reads `package.json` with `join(__dirname, "../../../../package.json")`.
- Flags today: `-D,--include-dev`, `--dev-only`, `--init` (alias of the `init` subcommand), `--verbose`, `-d,--directory <dir>`, `init` subcommand, `-v`/`--version` (a fake subcommand named `-v`).
- The root `package.json` carries a stale `dependencies` block (nx-era leftover) duplicating the package's.
- `packages/license-cop-e2e` spawns `npm exec "../../../packages/license-cop"` (`src/lib/helpers.ts`) and its `turbo.json` declares `license-cop#build`. Path references elsewhere: `integration.yml:128` (`local-licenses` bin path), `.github/actions/test-cli/action.yml` description, `repository.directory` in the package manifest.

## Decisions (settled here, so the phases don't churn)

1. **Core's logging seam:** `LicenseCopOptions` gains an optional `onVerbose?: (message: string) => void` (default: no-op, so library use stays silent exactly as today). Engine functions that log take it as a parameter: `checkLicenses` → `DependencyScanningOptions` (already `Required<LicenseCopOptions>`, so it flows through free) → `npm`/`pnpm` scanners; `loadConfig(directory, onVerbose?)` → `loadParentConfig` → `parent-resolutions/*`; `readPackageJson(path, onVerbose?)`. `lib/logger.ts` is deleted from core. The CLI passes its own verbose sink into all of these.
2. **Core's public surface is exactly what the CLI needs, deliberately, not temporarily:** `checkLicenses`, `LicenseCopOptions`, the result types, plus `loadConfig`, `ConfigError` and `readPackageJson` (the CLI loads config, distinguishes its failure, and reads the scanned project's name). `version.ts` reads the CLI's own `package.json` itself rather than widening core for it.
3. **`workspace:*` vs npm:** npm can't resolve the `workspace:` protocol, so `npm exec ../../../packages/cli` would fail on the core dependency. `helpers.ts` switches to spawning `node <workspaceRoot>/packages/cli/dist/bin.js` directly — bun's workspace `node_modules` resolves core by symlink, and it matches what `local-licenses` does in CI.
4. **Usage-error exit code:** keep `1` for everything (config errors, usage errors) unless you'd rather adopt `2` for bad command lines. The e2e suite only asserts 0/1 today, so `2` is a safe but visible change — say if you want it, otherwise Phase B ships `1`.
5. **`license-cop-e2e` rename:** skipped. Cosmetic, and 2.5 reshapes that package anyway.

## Phase A — 2.1: split out `@license-cop/core`

1. **Rename** `git mv packages/license-cop packages/cli` as its own commit, nothing else, so history follows. `bun install` to refresh links. Package `"name"` stays `license-cop`.
2. **Extract core.** `git mv` the engine modules from `packages/cli/src/lib/` to `packages/core/src/lib/` at the same relative paths: `license-cop.ts`, `result.ts`, `logger.ts`, `config/**` (incl. `parent-resolutions/`, `parsers/`), `dependency/**`, `dependency-scanning/**`, `spdx/**`, `utils/**`, with their specs. Move `src/index.ts` and delete its `commander`/`@nx/dependency-checks` hack block (moot since 1.5). The logger can't simply move with them, because the CLI needs it too. So implement decision 1 (the `onVerbose` hook) _inside this phase_: it's small and mechanical, and lets core ship without the singleton from its first commit. The CLI keeps its own `lib/logger.ts` for `log`/`error` and passes `logger.verbose` as `onVerbose`.
3. **Core packaging.** `packages/core/package.json`: `@license-cop/core`, `0.0.0`, `type: commonjs`, `main`/`types` → `./dist/index.{js,d.ts}`, `files: ["dist"]`, no `bin`; `version`/`pack`/`publish` scripts copied from `packages/permissive`; `build`/`typecheck`/`lint`/`test` from the current package; `repository.directory: "packages/core"`. Dependencies: `@npmcli/arborist`, `@pnpm/reviewing.dependencies-hierarchy`, `axios`, `compare-versions`, `cosmiconfig`, `deepmerge`, `git-filesystem`, `json5`, `zod` (same ranges as today). Add `tsconfig.json`, `tsdown.config.mts` (`entry: { index: "src/index.ts" }`, otherwise as today, keep `.mts`), a short `README.md`, and `LICENSE.md`. `index.ts` exports per decision 2.
4. **Rewire the CLI.** Imports from `../../config/...` etc. become `@license-cop/core`. `package.json`: drop `main`/`types`, add `"@license-cop/core": "workspace:*"`, keep `commander`/`@commander-js/extra-typings` (they go in Phase B), keep `zod` only if the CLI still imports it, `repository.directory: "packages/cli"`. tsdown: `entry: { bin: "src/bin.ts" }`, `dts: false`. Core must stay external; check `dist/bin.js` contains `require("@license-cop/core")` and hasn't inlined it.
5. **`version.ts`:** run `node packages/cli/dist/bin.js -v` before touching anything. The current `../../../../package.json` was written for the unbundled layout; in `dist/bin.js` `__dirname` is `dist`, so it likely already resolves outside the package. If broken, fix to read `join(__dirname, "../package.json")` with plain `readFile` + `JSON.parse`. (Phase B replaces this file, but fixing it now keeps Phase A honest.)
6. **Root cleanup.** Remove the stale root `dependencies` block after checking each entry's real consumer: `@pnpm/logger` and `tslib` aren't declared by the package today (`@pnpm/logger` is a peer of `@pnpm/reviewing.dependencies-hierarchy` and likely belongs in core); `hastscript`/`@primer/octicons` belong to `apps/website` — move only if clearly so, otherwise leave and flag. `bun install`; the `bun.lock` diff should be only the workspace shuffle.
7. **Paths and CI.** `helpers.ts` per decision 3; `integration.yml:128` and the `test-cli` action text → `packages/cli/dist/bin.js`; confirm core's `dist` rides in the `packages/**/dist` build artifact (`local-licenses` and `e2e` need it at runtime). `license-cop-e2e/turbo.json` keeps `license-cop#build`; the CLI's `^build` already builds core first via the workspace dependency.
8. **Release plumbing.** `bunx turbo run version|pack|publish` are unfiltered, so core is picked up automatically. Add `"dependsOn": ["^publish"]` to the `publish` task in `turbo.json` so core reaches the registry before the CLI (the CLI tarball will pin `@license-cop/core@<version>`). **Manual, outside the repo:** configure the npm trusted publisher for `@license-cop/core` (workflow `deployment.yml`) — it blocks the first release. `create-release`'s `files: packages/**/*.tgz` will attach both tarballs; decide if that's wanted.
9. **Sweep:** `grep -rn "packages/license-cop" --exclude-dir=node_modules --exclude-dir=dist .` should hit only `packages/license-cop-e2e`; also check `.renovaterc.json`, `.cspell.json`, `.idea/`, and `apps/website` docs.

**Phase A exit check:** `bun install`; `bunx turbo run build typecheck lint test`; `node packages/cli/dist/bin.js -v`, `--help`, a real run against this repo with `--verbose` (engine verbose lines still appear); `bunx turbo run e2e --filter=license-cop-e2e` with the same pass/fail split as before; `bun pm pack` in both packages and confirm the CLI tarball pins a real core version, not `workspace:*`.

## Phase B — 2.2: `Io` seam, `parseArgs` + `zod`, drop commander

Target layout in `packages/cli/src/` (per the 2.2 table): `bin.ts`, `main.ts`, `io.ts`, `errors.ts`, `help.ts`, `args/{schema,parse}.ts`, `commands/{check,init}.ts`, `report-failure.ts`, `report-success.ts`. `lib/cli/**` and `lib/logger.ts` (CLI's copy, if any remains) disappear.

1. **`io.ts`:** `Io` interface with `stdout(line)` and `stderr(line)` (line-oriented, matching current `console.log`/`console.error` use), and `defaultIo` backed by `console`. Verbosity is not global: it's a `verbose: boolean` on the parsed options, and a small helper (e.g. `verboseSink(io, verbose)`) returns the `(message) => void` used both for the CLI's own verbose lines and as core's `onVerbose`. The "Verbose logging enabled" line the logger emits on enable is preserved by emitting it once at the top of `run` when `verbose` is set.
2. **`errors.ts`:** `UsageError`, thrown by `args/parse.ts` for a bad command line (unknown flag, missing value). `ConfigError` (from core) is caught in `run()` alongside it — both print the message to `io.stderr` and return exit code `1` (decision 4). Failures after a valid command line stay reported by their handler; a usage reminder wouldn't help there.
3. **`args/schema.ts` + `args/parse.ts`:** `parseArgs` (`node:util`, `strict: true`) tokenizes `argv.slice(2)`; `zod` validates into a `CliInvocation` discriminated union: `check` (options: directory, includeDev, devOnly, verbose), `init` (directory, verbose), `version`, `help`. **Port the flags exactly as they are today** — including the `--init` alias, `-D`/`--include-dev`/`--dev-only` as two booleans, `-v`/`--version`, and `init` as a positional subcommand — so Phase C is the only place behaviour changes. `-d,--directory` defaults to `process.cwd()` as today (resolved in `run`, not at import time, so it's testable).
4. **`main.ts`:** `run(argv, io = defaultIo): Promise<number>`; parses, dispatches on `invocation.kind`, returns the exit code, never touches `process.exitCode`. Catches `UsageError`/`ConfigError`.
5. **Commands:** `commands/check.ts` `runCheck(options, io): Promise<number>` — the old `runLicenseCop`, calling core's `loadConfig`/`checkLicenses` with the verbose sink; returns `1` when `noLicenses` or `forbiddenLicenses` is non-empty, else `0`. `commands/init.ts` `runInit(options, io)` — writes `.licenses.json` via the same `defaultConfig` template, output through `io`. `report-failure.ts`/`report-success.ts`: signature becomes `(result, io)`, `logger.*` → `io.*`, and `report-success` no longer sets `process.exitCode` (the caller returns the code).
6. **`help.ts`:** `helpText()` and `versionText()` as plain functions (version read from the CLI's own `package.json`, as fixed in Phase A). Help must be hand-written now that commander isn't generating it — write it to cover every flag in the schema, and keep it next to the schema so they change together.
7. **`bin.ts`:** thin glue only — `process.exitCode = await run(process.argv, defaultIo)` with a top-level `catch` that prints unexpected errors to stderr and sets exit code `1` (today an unexpected throw surfaces as an unhandled rejection; make that explicit). Keep the shebang.
8. **Dependencies:** remove `commander` and `@commander-js/extra-typings` from `packages/cli/package.json` (and the lockfile); `zod` stays.
9. **Tests (small, high value, in-scope because the seam exists now):** a spec for `args/parse.ts` (every flag, every `UsageError` case) and for `run` with a fake `Io` (version, help, init writes file + output, check success/failure exit codes). This is a slice of 2.5's "everything else untested" list; do only enough to lock the parser rewrite in place — the rest stays in 2.5.

**Phase B exit check:** same as Phase A's, plus: `--help` output reviewed by hand against the old commander output for missing flags; the e2e matrix unchanged (proves flags behave identically); `grep -rn commander packages/cli` returns nothing; no `process.exitCode` assignments outside `bin.ts`.

## Phase C — 2.3: neaten the flags

Depends on decisions only you can make; each is a small edit to `args/schema.ts`/`args/parse.ts`/`help.ts` plus the fixtures. Recommended calls in brackets:

- `-v`/`--version`: now an ordinary `version` invocation; confirm the names still read well. [Keep `-v`/`--version`.]
- `--init` vs `init`: [drop the `--init` flag, keep the `init` subcommand — one form, and `init` is what every doc and the CLI's own success message tells people to type.]
- `-D,--include-dev` + `--dev-only`: [one flag, `--dev-dependencies <include|only>`, default prod-only, so "both true" is unrepresentable; the `LicenseCopOptions` shape (two booleans) is unchanged, mapped in `runCheck`. Also decide whether the `.licenses.json` config's `includeDevDependencies`/`devDependenciesOnly` keys should be aligned — a config-schema change, so a bigger break; default is leave the config alone.]
- `--verbose`/`-d` on `init`: [keep `-d`; `--verbose` on `init` is inert beyond one write path, so accept it silently rather than erroring on a flag every other command takes — or drop it; your call.]
- Update `init`'s generated template, `--help`, the CLI `README.md`, `apps/website` docs, and every `packages/license-cop-e2e` fixture named after a flag behaviour (`e2e/**/should-*`) together.

Why a separate phase from B: with flags ported verbatim in B, the unchanged e2e suite is proof the parser rewrite didn't break anything. Changing flags in the same commits would lose that. One question per flag, in order, will be raised before Phase C starts rather than answered here.

## Commit sequence

1. Rename `packages/license-cop` → `packages/cli` (pure `git mv`).
2. Extract `packages/core` (moves, manifest/tsconfig/tsdown, `index.ts` cleanup, `onVerbose` hook replacing the logger in core).
3. Rewire the CLI onto core; `version.ts` fix; root manifest cleanup + `bun.lock`.
4. Paths/CI/e2e helper; `publish` ordering. **Phase A green.**
5. `Io`, `errors`, `args/*`, `main`, commands, reports, `help`, `bin` — one commit per new module where it stays green, dropping commander last.
6. Parser/`run` specs. **Phase B green.**
7. Flag changes, docs and fixtures. **Phase C green.**
8. Update `migration.md`: tick 2.1–2.3 and add "found during implementation" notes, Part 1 style.

## Risks

- **First publish of `@license-cop/core`** needs manual npm-side setup and publish ordering; a botched first release leaves `license-cop` depending on an unpublished package.
- **`onVerbose` threading** touches ~10 engine signatures in Phase A. It's mechanical, but it's the one place Phase A isn't a pure move; the `--verbose` check in the exit criteria catches a missed call site (the engine would go silent).
- **`workspace:*` under npm** breaks anything installing from the source tree rather than a packed tarball — grep `e2e/**` fixtures for any that reference the CLI by path.
- **Hand-written help** can silently drift from the schema; keeping both in `args/` and covering every flag in a spec mitigates it.
- **Bundling assumption:** if tsdown inlines core into the CLI bundle, the split works locally but publishes a duplicated engine; the `dist/bin.js` inspection in Phase A catches it.

## Out of scope

Classifier extraction (2.4), test pyramid and e2e restructuring (2.5), the network-fetching DI seam for `parent-resolutions` (2.5), renaming `license-cop-e2e`, and bun detection (Part 3).
