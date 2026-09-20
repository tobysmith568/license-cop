# Final pass on milestones 2.1–2.5

An evaluation of the 2.x work against the plan in [migration.md](migration.md). Typecheck, lint and Prettier are clean; core (198), cli (41) and cli-e2e (19, real installs for npm, pnpm, yarn 1/3/4) all pass. Core coverage is 99.5% lines / 100% functions; CLI coverage is 92.7% lines. No functional blockers were found, but the items below stand between "done" and "done to a high quality".

## 1. A missing `package.json` prints a raw stack trace

Running the built binary in a directory with no `package.json` prints `Error: Cannot find the file: '…/package.json'` followed by a full stack, exit code 1. `readPackageJson` throws a plain `Error`, and `run()` (in `packages/cli/src/main.ts`) only handles `UsageError` and `ConfigError`; anything else falls through to `bin.ts`'s catch-all, which prints `error.stack`. 2.2 says moving the catch up to `run()` means every entry point gets the same "print message, set exit code" treatment, but this very common failure isn't covered, and nothing tests it.

**Fix:** give core a typed error for "can't read this project" (or reuse `ConfigError`), catch it in `run()`, and add a `main.spec.ts` case for a directory with no `package.json`.

## 2. CLI test coverage has holes

- `report-failure.ts`: the `noLicenses` branch (lines 14 and 22–29) is never exercised; only the forbidden-license path is, through `main.spec.ts`.
- `report-failure.ts` and `report-success.ts` are pure `(result, io)` functions with no specs of their own.
- `io.ts` (60% functions): `defaultIo` and the disabled path of `createVerboseLogger` have no direct spec.
- `main.ts`: the exhaustive-default branch is unreached (this one is acceptable).

**Fix:** add `report-failure.spec.ts`, `report-success.spec.ts` and `io.spec.ts` using the fake `Io`.

## 3. The built binary is barely tested at the smoke tier

`cli-e2e/src/lib/cli.spec.ts` only asserts "exit 1 on a forbidden license, exit 0 when allowed", for npm and pnpm. Nothing runs `--version`, `--help` or `init` against `dist/bin.js`. This matters because `versionText()` resolves `../package.json` from `__dirname`, which works only because `src/` and `dist/` happen to sit one level below the package root; only a built-binary test would catch that breaking. CI's `.github/actions/test-cli` covers `--version` and `--help`, but `cli-e2e` doesn't, so the local `turbo run e2e` doesn't either.

**Fix:** add `--version`, `--help` and `init` cases to `cli.spec.ts` (they don't need a package manager install).

## 4. Help text and the argument parser can drift

`help.ts` is a hand-written string and `args/parse.ts` declares the options separately. Nothing checks that every declared flag appears in the help, or the reverse.

**Fix:** either a spec asserting each option name in the `parseArgs` config appears in `helpText()`, or derive both from one options table.

## 5. Removed-flag detection matches any argv element

`throwIfRemovedFlag` in `args/parse.ts` scans every argument, including flag values. A `-d <dir>` value that equals `--init`, `-D`, `--include-dev` or `--dev-only` would be reported as a removed flag. Very unlikely in practice, but it's a correctness wart in a function whose whole job is a precise error message.

**Fix:** check only tokens `parseArgs` classifies as options (`tokens: true`), or stop scanning after a flag that takes a value consumes its argument. Add a spec for the value case.

## 6. `--dev-dependencies` and `init` are undocumented

The README, the copy in `packages/cli`, and `apps/website/src/pages/docs.md` document the `includeDevDependencies` / `devDependenciesOnly` config keys but never the `--dev-dependencies <include|only>` flag. 2.3's own notes flag this as "worth a docs pass separately".

**Fix:** document the flag in all three places, including that config keys still apply when the flag is absent.

## 7. Flag and config precedence, and the "illegal state" goal

`packages/cli/src/commands/check.ts` maps the flag onto the two booleans with `devDependencies === "include" || config.includeDevDependencies`. Consequences:

- A config with `includeDevDependencies: true` can't be overridden back to "production only" from the CLI.
- `--dev-dependencies only` combined with `includeDevDependencies: true` in config yields both booleans true, which is the "both true" state 2.3 set out to make unrepresentable. It's only unrepresentable at the CLI flag; `LicenseCopOptions` and the config keys still carry two booleans (a deliberate, documented choice, and core treats both-true as "only", per `dev-dependencies.spec.ts`).
- The mapping itself has no unit test of its own; it's only exercised through `main.spec.ts`.

**Fix:** decide the intended precedence (flag beats config, presumably), extract the mapping into a small tested function, and either make core's options a single mode or document the both-true behaviour.

## 8. CI leftovers and unverified platforms

- `integration.yml`'s `e2e` job still runs `corepack enable`. Yarn is now run straight from the committed releases, so this only matters for pnpm; confirm it's still needed and that the pnpm version it resolves is what's intended.
- The Windows `file:` specifiers (forward-slash absolute paths) used by `cli-e2e` are unverified on the Windows leg (noted in 2.5).

## Duplication and design worth extracting

- **Test helpers are duplicated.** Temp-dir creation exists in four places (`core/src/lib/test-utils/temp-dir.ts`, `cli/src/main.spec.ts`, `core/.../dev-dependencies.spec.ts`, `cli-e2e/src/lib/project.ts`), plus repeated `writeJson`. See the recommendation discussed alongside this file.
- **Async node-walking loop** is repeated in `npm.ts` and `pnpm.ts` (`normalizeNodes`); a small shared helper would remove it. Minor.
- **`package.json` scripts and `tsdown.config.mts`** are copy-pasted across core, cli and the fixture packages. Not urgent.
- **`NormalizedNode`'s `id`/`name` differ per engine** (npm: `node.pkgid` / `node.name`; pnpm: `${alias}@${version}` / `packageJson.name`). Deliberate, but undocumented on the type and untested for aliased dependencies.

## Testability notes

Every unit is now testable and nearly all are tested. The CLI's tests run against core's built `dist/` (see the discussion alongside this file), so `bun test` inside `packages/cli` fails without a prior build; turbo's `dependsOn: ["^build"]` hides this in normal use.

## Suggested order

1. Handle the missing-`package.json` error, with a test (1).
2. Add the report/io specs and extract-and-test the flag mapping (2, 7).
3. Add `--version` / `--help` / `init` to the built-binary smoke tests (3).
4. Fix the removed-flag scan and the help/parser drift check (4, 5).
5. Document the flag (6).
6. Consolidate the test helpers (design section) and tidy CI (8).
