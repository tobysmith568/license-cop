# Final touches

Follow-up to the final pass on the 2.x milestones in [migration.md](migration.md): the gaps and cleanups that review found, worked through before Part 3 (bun) starts, so that bun and Plug'n'Play are added on top of a settled base. Nothing here changes the shape of the migration; it closes holes in what 2.1–2.5 delivered.

Each item says what was found, what was verified, and what "done" looks like. Where an item was spiked, the result is recorded here so it isn't re-derived. Tick items off as they land. Anything that can change the outcome of a run for an existing user (a check that used to pass and now fails, a flag or output change) also gets an entry in [breaking-changes.md](breaking-changes.md) when it lands.

## Suggested order

1. **Foundations** (F1–F3): no behaviour change, and every later item leans on them.
2. **Correctness** (G1–G3): the engine false negatives, tests first.
3. **CLI** (G4, G5, C4, C5, C6): `init`, error handling, the core API boundary, and arg parsing.

## Foundations

### F1 One shared `fileExists` ✅ done

`fileExists` is copied three times: [get-package-manager.ts](packages/core/src/lib/dependency/get-package-manager.ts) and [plug-and-play.ts](packages/core/src/lib/dependency/plug-and-play.ts) each carry an `access`-based copy, and [package-json.ts](packages/core/src/lib/dependency/package-json.ts) has a `stat().isFile()`-based `doesFileExist`. None has its own test.

- [x] Add `lib/utils/file-exists.ts` and a spec (existing file, missing file, a directory at that path).
- [x] Use `stat().isFile()` semantics: the package.json copy is the stricter one, and every current caller (`yarn.lock`, `pnpm-lock.yaml`, `.pnp.cjs`, `package.json`) is looking for a file. Say so in a comment, since `access` would also have said yes to a directory.
- [x] Delete the three private copies.

### F2 A `LicenseCopError` base class ✅ done

There are four error classes with no common ancestor: `ConfigError` (which doesn't set `name`, and prefixes its message with `Config error:`), `PackageJsonError`, `UnsupportedProjectError`, and the CLI's own `UsageError`. [main.ts](packages/cli/src/main.ts) handles the first three through a hard-coded `instanceof` list, so a new error type that isn't added there surfaces as a stack trace. Parts 3 and 4 and items G3/G4 below each add one.

- [x] Add `LicenseCopError` to core, setting `this.name = new.target.name` so subclasses no longer repeat it. Export it from `index.ts`.
- [x] `ConfigError`, `PackageJsonError` and `UnsupportedProjectError` extend it. Keep `ConfigError`'s message prefix.
- [x] `main.ts` catches `LicenseCopError` instead of the list. `UsageError` stays CLI-local and separate: it is the only one that prints the "Run 'license-cop --help'" hint.
- [x] Specs: each subclass is an `instanceof LicenseCopError` and has the right `name`; `run` returns 1 with the message for a fresh subclass that `main.ts` has never heard of.

### F3 Explicit engine dispatch ✅ done

[license-cop.ts](packages/core/src/lib/license-cop.ts) is a `switch` whose `default` sends everything that isn't pnpm to the npm engine. That is correct today (yarn shares npm's layout) but implicit, and a new `PackageManager` member (bun, and later yarn-with-PnP) would fall through to the npm engine silently.

- [x] `const engines: Record<PackageManager, DependencyScanner>` in `license-cop.ts`, with `npm` and `yarn` both mapped to `npmDependencyScanning` and a comment saying why. A new package manager is then a compile error until it's given an engine.
- [x] Give the engines a shared type (`DependencyScanner = (options: DependencyScanningOptions) => Promise<CheckLicensesResult>`) in `dependency-scanning/options.ts`; `dev-dependencies.spec.ts` already declares its own `Scan` type for this.
- [x] The existing "choosing an engine" specs in `license-cop.spec.ts` should pass unchanged.

## Correctness

### G1 pnpm silently skips optional dependencies ✅ done

**Verified.** A project with `dependencies: { prod-pkg (MIT) }` and `optionalDependencies: { opt-pkg (ISC) }`, real installs from local tarballs, scanned with only MIT allowed:

| Package manager | `opt-pkg` in `node_modules` | Result                                         |
| --------------- | --------------------------- | ---------------------------------------------- |
| npm             | yes                         | `opt-pkg` reported as forbidden                |
| pnpm 10         | yes                         | **not scanned**, no forbidden license reported |
| pnpm 12         | yes                         | **not scanned**, no forbidden license reported |

So the two engines disagree, and pnpm produces a false negative for a package that is installed and shipped. [pnpm.ts](packages/core/src/lib/dependency-scanning/pnpm.ts) passes `optionalDependencies: false` to `buildDependenciesTree`, then reads `hierarchies.optionalDependencies` anyway, which is dead code today. npm is the right behaviour: an optional dependency that got installed is a dependency.

- [x] Add a contract test first (an optional dependency with a forbidden license, run against every package manager in `packageManagers`), and watch it fail for pnpm. This needs a fixture package with a different license; `packages/e2e/isc-package` can serve as the optional one.
- [x] Fix: `optionalDependencies: !devDependenciesOnly` in the pnpm engine, mirroring `dependencies` (an optional dependency is a production one, and arborist already excludes it from a dev-only scan by way of `node.dev`).
- [x] Extend `dev-dependencies.spec.ts` (or its successor) so the default / include / only modes are pinned for optional dependencies in both engines.
- [x] Checked by the same contract test: yarn 1/3/4 match npm and pnpm 11 matches the other pnpms (before the fix: only pnpm 10/11/12 failed; after it, all seven package managers pass).

### G2 Workspaces (root scans done; member scans continue in G3)

**Verified, and worse than expected.** A root with `workspaces: ["packages/*"]`, member `a` depending on `prod-pkg` (MIT) and member `b` depending on `opt-pkg` (ISC), real installs, MIT only allowed:

| Scan target    | npm                                                | pnpm 12           |
| -------------- | -------------------------------------------------- | ----------------- |
| workspace root | finds `a`, `b`, `prod-pkg` and forbidden `opt-pkg` | **finds nothing** |
| member `a`     | **finds nothing**                                  | finds `prod-pkg`  |

Two different false negatives, both passing with exit code 0:

- **pnpm from the root** scans nothing: `buildDependenciesTree` is only given `[workingDirectory]`, so only the root importer is read, and the root has no dependencies of its own. `Object.values(dependencyHierarchies)` in the engine implies it was written expecting several importers.
- **npm from a member** scans nothing: the member has no `node_modules` of its own, because everything is hoisted to the root.

**Two more found while writing the tests** (both fixed):

- **npm and yarn reported the members themselves.** A workspace member shows up in the tree as a linked package, so a member with no `license` (typical, since it's the project's own code) was reported as a package with no license, failing the check.
- **pnpm reported a member that another member depends on** (`workspace:*`) the same way, as an unlicensed `link:` dependency.

- [x] Add workspace contract tests: `workspaces.spec.ts`, a root with three members (one depending on `mit`, one on `isc`, one on the first member), unlicensed members, all seven package managers, scanned from the root. It failed for npm and yarn (members reported) and for pnpm (nothing found). `createProject` gained a `members` option and `PackageJsonBuilder` gained `dependsOnMember`. **Scanning from a member is not covered here**: it needs G3's error for npm and yarn, so its tests are added there for every package manager together.
- [x] **Semantics decided.** Scanning a workspace root covers the dependencies of every member, and never the members themselves. Scanning a member's own directory covers what that package manager has installed for it: pnpm gives that member's dependencies, and npm and yarn (which hoist everything to the root) currently give nothing, which G3 turns into an error pointing at the workspace root. The earlier recommendation to refuse member scans everywhere was dropped: it would need a workspace-detection step per package manager, to refuse a scan that already works on pnpm.
- [x] pnpm root: the lockfile's `importers` (every project it covers) are handed to `buildDependenciesTree`, rather than only the working directory. This adds `@pnpm/lockfile.fs` as a direct dependency of core (already a transitive one of the hierarchy library), and falls back to the working directory when there is no lockfile. Reading `pnpm-workspace.yaml` instead would have needed a YAML parser and globbing.
- [x] Workspace members are skipped rather than classified: by arborist's `isWorkspace` for npm and yarn, and, for pnpm, by a linked node's path being one of the scanned projects. Their dependencies are still walked in both engines.
- [ ] npm member: falls out of G3 (declared dependencies, nothing installed), provided that check gives a message that mentions running from the workspace root.
- [x] yarn 1/3/4 workspaces follow npm, and are covered by the same test.

### G3 A project that isn't installed passes ✅ done

Today a project with no `node_modules` scans as an empty tree and passes, whichever package manager it uses. This is the same false negative that `UnsupportedProjectError` already closes for Plug'n'Play, and G2's npm-member case needs it too. It was listed as a separate gap under Part 4; it belongs here, before bun adds another package manager that has to honour it.

- [x] **A project with no dependencies must still pass.** Only fail when the package.json declares dependencies that the scan mode would include (production by default, dev with `include`/`only`) and the engine found no installed tree. Pin that with a test first, since getting it wrong turns a valid empty project into an error.
- [x] Add a `NotInstalledError` extending `LicenseCopError` (F2) with a message naming the package manager's install command. Exported from core, so the CLI needs no change beyond F2.
- [x] Where it's checked is a design decision for the implementation: probably in `checkLicenses`, between choosing the engine and running it, using `readPackageJson`-style access to the declared dependencies. Yarn Plug'n'Play keeps its own earlier `assertNotPlugAndPlay` refusal until Part 4 replaces it.
- [x] Tests: not installed with dependencies (fails, per package manager family), not installed with none (passes), installed (passes), dev-only scan with only production dependencies declared and none installed (decide and pin whether that fails).
- [x] Remove the "Related, separate gap" paragraph from Part 4 of migration.md once this lands.

**How it landed.** `assertInstalled` (core, called by `checkLicenses` after the Plug'n'Play refusal) reads the declared dependencies from the package.json and fails with `NotInstalledError` when any are in scope for the current mode and there is no `node_modules` directory. The dev-dependency options decide what is in scope: a dev-only scan of a project with no dev dependencies passes, and a production scan ignores declared dev dependencies. The message names the package manager's install command and suggests the workspace root. The member-scan tests for every package manager are in `workspaces.spec.ts` (pnpm members work, npm and yarn members are refused). **Known limit:** the check is only that `node_modules` exists, not that every declared dependency is in it, so a partial install still passes, and so does a workspace member that has some nested `node_modules` of its own.

### G4 `init` refuses when a config already exists

[init.ts](packages/cli/src/commands/init.ts) writes `.licenses.json` unconditionally, overwriting an existing file, and has no test for it. It must fail if the project already has _any_ config that license-cop would load, not only the file `init` itself creates.

The search list lives privately in [find-config.ts](packages/core/src/lib/config/find-config.ts): four module names (`licenses`, `licences`, `licensesrc`, `licencesrc`) across `.name`, `.name.{json,jsonc,json5,yaml,yml,js,cjs}`, `.config/name…` and `name.config.{js,cjs}`, plus a `licensecop` key in `package.json`.

- [ ] Add a core function (for example `findConfigFile(directory): Promise<string | undefined>`) that reuses the same `searchPlaces` and cosmiconfig options as `findConfig`, so the two can never drift apart, and export it. `init` must not keep its own list.
- [ ] `runInit` checks it first and, if a file is found, fails with a message naming that file and exit code 1, without writing anything. Route it through a `LicenseCopError` subclass (F2) so it is reported like the other user-facing failures.
- [ ] Only the target directory counts. `findConfig` stops at `rootDir` anyway, so there's no parent-directory case to think about.
- [ ] Follow cosmiconfig's own semantics for the odd cases and pin them: a `package.json` without a `licensecop` key is _not_ a config; an empty config file is skipped by cosmiconfig and by `findConfig` alike. Decide explicitly whether an empty file blocks `init` (recommended: it does, since the user clearly put it there, so this may mean checking file existence directly rather than through cosmiconfig; settle it while writing the spec).
- [ ] Specs: one per config location shape (a dotfile, a `.config/` file, a `*.config.js`, a `licensecop` key in package.json, each spelling of the module name is not needed in full: a couple per shape is enough), that nothing is overwritten, and that a clean directory still works. Add the built-CLI case to `cli.spec.ts` (init twice: the second exits 1).
- [ ] README, the copy in `packages/cli`, and `apps/website/src/pages/docs.md`: say that `init` won't overwrite an existing config.

### G5 Graceful unexpected errors

Anything that isn't a known error currently escapes `run` (the rethrow at [main.ts:32](packages/cli/src/main.ts#L32)) into the catch in [bin.ts](packages/cli/src/bin.ts), which prints the full stack trace. Neither is tested, and `bin.ts` has no direct test at all. Some of these failures are entirely ordinary and shouldn't look like a crash: `init` in a directory that doesn't exist or can't be written to (`ENOENT`/`EACCES` from `writeFile`), or `--directory` pointing at nothing.

- [ ] `run` never throws. Unexpected errors are reported as `error: <message>` on stderr with exit code 1; the stack is only printed with `--verbose`, and otherwise the output says to re-run with it. Parse-time failures are all `UsageError`s already, so the verbose flag is available for everything that reaches this path.
- [ ] Handle the filesystem errors `init` and the config/package.json reads can produce as user-facing failures with a sentence, not a Node error string: a missing or unwritable directory, in particular. Decide where that lives (a small helper that maps `ENOENT`/`EACCES`/`EISDIR` to a message, or checking the directory up front), and test both codes.
- [ ] `bin.ts` shrinks to `process.exitCode = await run(process.argv.slice(2), defaultIo)` with no catch of its own, which leaves nothing in it worth a test beyond the existing built-CLI smoke tests. If a catch-all is kept for bugs in `run` itself, cover it with a smoke test that forces a crash.
- [ ] Specs in `main.spec.ts`: an unexpected error gives exit 1 and a one-line message without `--verbose`, the stack with it; `init` into a missing directory gives a friendly message.

## Cleanliness

### C4 Move the config-to-options step into core

The core API currently exports `loadConfig`, `readPackageJson` and `PackageJsonError` mainly so the CLI can do its job, and the step that merges the config file with the `--dev-dependencies` flag ([dev-dependencies.ts](packages/cli/src/commands/dev-dependencies.ts)) lives in the CLI. A library user cannot get "what the CLI would do for this directory" without copying it, and the merge rule is business logic, not presentation.

- [ ] Move `DevDependenciesMode` and `resolveDevDependencyOptions` into core, with their spec.
- [ ] Add one core function that resolves everything the CLI needs before scanning: the project's name, the loaded config, and the ready-to-use `LicenseCopOptions` (config plus the dev-dependencies flag). Recommended shape: `resolveCheckOptions(directory, { devDependencies, onVerbose })` returning `{ productName, options }`, so the CLI can still print "Scanning dependencies of: …" _before_ the scan starts (and before a slow one finishes), then call `checkLicenses(options)`.
- [ ] `check.ts` uses it. This also fixes C6c (`package.json` read twice), since only core reads it.
- [ ] Once the CLI no longer needs them, stop exporting `loadConfig`, `readPackageJson` and `PackageJsonError` from core if nothing else does (the CLI's [help.ts](packages/cli/src/help.ts) reads its own version through `readPackageJson`; either give it its own tiny reader or keep that one export, and record which). Anything removed from the public surface should be re-checked against `packages/core/README.md`.

### C5 Lean into zod for argument parsing

Yes, this is better. Today [parse.ts](packages/cli/src/args/parse.ts) builds the invocation object by hand, validates the mode by hand (`parseDevDependencies`, alongside an unused-in-practice `devDependenciesModeSchema`), rejects `init --dev-dependencies` and stray positionals by hand, and _then_ runs the finished, already-typed object through zod, a step whose failure branch is unreachable and untested. There are two sources of truth for the mode and a validation step that can't fail.

- [ ] Validate the _raw_ tokenized values with zod instead: parse `parseArgs`' output through a schema (a discriminated union on the command taken from `positionals[0]`) that owns the enum, the `init` + `--dev-dependencies` exclusion and the unexpected-argument rule, and produces the `CliInvocation` directly. Delete the hand-rolled `parseDevDependencies` and the after-the-fact `validate`.
- [ ] Keep every user-facing message word for word: `parse.spec.ts` pins them, and it is the safety net for this refactor, so refactor with it green rather than rewriting the specs. zod's default messages are not user-friendly (see the note in 2.3 about `exclude` leaking through), so each rule needs a custom `error`.
- [ ] `throwIfRemovedFlag` stays a pre-pass; it exists to give a better message than a schema could.
- [ ] Check the result against `z.prettifyError`'s output for the cases that remain, and keep `schema.ts` as the one place the invocation shape is defined.

### C6 Small inconsistencies in `check`

- [ ] **C6a Exit logging.** [check.ts](packages/cli/src/commands/check.ts) logs `Exiting with error code 0` in verbose mode on success only, which is wrong twice over: 0 isn't an error code, and the failure path (exit 1) says nothing. Log `Exiting with code N` on both paths (one place, after the result is known), and update the specs that match the old wording.
- [ ] **C6b Streams.** [report-failure.ts](packages/cli/src/report-failure.ts) prints `Found the following issues...` to stdout and the details to stderr, so a user who redirects one stream gets half a report and the wrong order. Send the whole failure report to stderr, and update `report-failure.spec.ts` and any smoke test that reads only stdout.
- [ ] **C6c Double read.** Resolved by C4; nothing separate to do.

## Decided, no action

### D1 Tests need `--isolate`

Running bare `bun test` in `packages/core` fails around 30 tests, because `mock.module` in one file leaks into others. `--isolate` fixes it and is set in every package's `test` script, so turbo and CI are fine. **Checked whether it can be set in `bunfig.toml`: it can't.** On bun 1.4.0 a `[test]` section with `isolate = true` is silently ignored (a two-file spike, one mocking a module and one importing it for real, still failed the second file), and `--isolate` / `--parallel` are only CLI flags. So there is nothing to change.

- [ ] Only worth one line of documentation: tests are run through `bun run test` / turbo, and a bare `bun test` in a package will show spurious failures. Put it wherever contributor notes live (`docs/` next to `updating-package-managers.md`, or the README).

### D2 Shared recursive walk in the npm and pnpm engines

The two engines each have a small `normalizeNode`/`normalizeNodes` pair. They differ (npm filters out `undefined` nodes, pnpm doesn't), the shared part is about six lines, and the dev-dependency behaviour is already pinned by `dev-dependencies.spec.ts`. Extracting it now adds indirection for very little. **Not doing it now.** Revisit when Part 4's Plug'n'Play walker would be the third copy.

## Not yet triaged

Raised in the review, not yet decided:

- [ ] migration.md links to `migration-2.1-2.3-plan.md` at three places (2.1's, 2.2's and 2.3's notes), and that file is deleted, so the links are dead. Reword them, or drop them.
- [ ] `packages/test-utils` (added during 2.5, used by core, the CLI and cli-e2e) isn't mentioned anywhere in migration.md.
- [ ] Still open from 2.1: an npm trusted publisher must be configured for `@license-cop/core` (workflow `deployment.yml`) before the first release, or the publish fails.
- [ ] Still open from 2.5: the `file:` tarball specifiers have never been run on the Windows CI leg.
- [ ] Unreachable branches: the `never` exhaustiveness throws in `main.ts`, `dev-dependencies.ts` and `calculate-issues.ts` show as uncovered. Fine as they are; listed so nobody spends time chasing them.
