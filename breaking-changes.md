# Breaking changes

Source material for the release notes of the next major version. This file only lists changes that can break something a user of `license-cop` already has: their scripts, CI, config files or code. Refactors, tooling changes, fixes and additive features don't belong here, and neither do changes nobody could reasonably depend on (help wording, error message text).

The baseline for "what users have today" is the published `license-cop@1.9.0`. Each entry says what changed, who is affected, and how to migrate.

## Landed

### The programmatic API moved to `@license-cop/core` (2.1)

`license-cop@1.9.0` publishes `main: ./src/index.js` and `types: ./src/index.d.ts`, so `import { checkLicenses } from "license-cop"` works today. The package is now bin-only and no longer resolves as a library. The engine lives in a new package, `@license-cop/core`.

- **Affected:** anyone importing `checkLicenses`, `LicenseCopOptions` or the result types from `license-cop` in their own code. The API was never documented on the website or in the README, but it was published, so assume someone uses it.
- **Migrate:** `npm install @license-cop/core` and import from `@license-cop/core` instead. The exports are the same (`checkLicenses`, `LicenseCopOptions` and the result types: `CheckLicensesResult`, `AllowedPackage`, `LicensedPackage`, `NoLicenseResult`, `ForbiddenLicenseResult`).

### The published file layout changed (2.1, 1.5)

The CLI entry point moved from `src/bin/license-cop` to `dist/bin.js`, and the rest of the package's internal files (`src/lib/**`, `src/index.js`) are now bundled into `dist/` instead of shipped one file per module.

- **Affected:** anyone who invokes the file by its path (for example `node node_modules/license-cop/src/bin/license-cop` in a script or CI step), or who deep-imports from `license-cop/src/...`.
- **Migrate:** run the command by name instead: `npx license-cop`, an npm script, or `node_modules/.bin/license-cop`. None of those change. Replace deep imports with the public exports of `@license-cop/core`.

### `--init` flag removed (2.3)

`license-cop --init` no longer works; it now fails with a message pointing at the `init` command.

- **Affected:** scripts, docs or CI steps that run `license-cop --init`. The README and website used to describe this flag as the way to create a config file.
- **Migrate:** run `license-cop init` instead. It does exactly the same thing.

### `-D`, `--include-dev` and `--dev-only` replaced by `--dev-dependencies` (2.3)

The three flags are gone and now fail with a message naming the replacement. The new flag takes a mode: `--dev-dependencies include` also checks dev dependencies, and `--dev-dependencies only` checks only dev dependencies. Without the flag, only production dependencies are checked, as before.

- **Affected:** scripts and CI steps that pass `-D`, `--include-dev` or `--dev-only`. The flags were never documented on the website or in the README, but they were accepted and worked.
- **Migrate:** `-D` and `--include-dev` become `--dev-dependencies include`; `--dev-only` becomes `--dev-dependencies only`. The `includeDevDependencies` and `devDependenciesOnly` keys in the config file are unchanged and still work.

### `OR` license expressions are now satisfied by either side (2.4)

A package licensed `(MIT OR GPL-3.0)` used to be reported as forbidden unless _both_ licenses were allowed, because `OR` was evaluated exactly like `AND`. It now passes when either side is fully allowed, and is only reported when neither is. `AND` is unchanged.

- **Why:** an SPDX `OR` lets the licensee choose which license to use the package under, so allowing MIT is enough to use it. The old behaviour flagged packages that were legitimately usable and forced people to allow-list licenses they didn't want to accept.
- **Affected:** projects that have an `OR`-licensed dependency and rely on it failing the check, or that added a license to `licenses` (or the package to `packages`) only to work around it. Runs that used to fail may now pass.
- **Migrate:** nothing is required. If you allow-listed a license or package only to get past this, you can now remove it. If you want the old stricter behaviour for a package, don't allow-list the side you don't accept, and the other side still has to be allowed.

### A child config now inherits the parent's dev-dependency settings when it doesn't set them (2.4)

When a config used `extends`, defaults were applied to the child before merging, so a child that didn't mention `includeDevDependencies` or `devDependenciesOnly` silently reset the parent's `true` back to `false`. Values are now merged as written and defaults are applied once at the end, so an omitted setting inherits from the parent. A child that sets a value explicitly still overrides the parent.

- **Why:** this is what `extends` is documented to do, and the old result depended on an implementation detail (that defaults were applied early), which made a shared config's dev-dependency settings impossible to rely on.
- **Affected:** anyone extending a config that sets `includeDevDependencies` or `devDependenciesOnly` to `true`, from a child config that doesn't set them. Dev dependencies that used to be skipped are now scanned, so the check can newly fail.
- **Migrate:** if you don't want the inherited setting, set it to `false` explicitly in the child config.

### `--dev-dependencies only` now works on pnpm projects (2.4)

On pnpm projects, `devDependenciesOnly` (set by `--dev-dependencies only`, formerly `--dev-only`) scanned nothing and so always passed, because dev dependencies were only enabled when `includeDevDependencies` was also set. npm projects were not affected. It now scans the dev dependencies, as the option says.

- **Why:** the option was silently a no-op on pnpm, so the check gave a false pass.
- **Affected:** pnpm projects that use `devDependenciesOnly` or `--dev-dependencies only`. Runs that used to pass vacuously can now fail if a dev dependency has a forbidden or missing license.
- **Migrate:** fix or allow-list whatever the check now reports.

### Optional dependencies are now checked on pnpm projects (final touches)

On pnpm projects, `optionalDependencies` were never scanned, even when installed, so an optional dependency with a forbidden or missing license passed the check. npm and yarn projects were not affected and already checked them. They're now scanned with the production dependencies (so not by `--dev-dependencies only`).

- **Why:** an optional dependency that got installed is shipped like any other, so skipping it was a silent false pass.
- **Affected:** pnpm projects with an installed optional dependency that has a forbidden or missing license. Runs that used to pass can now fail.
- **Migrate:** fix or allow-list whatever the check now reports.

### Workspace members are no longer checked, and pnpm workspace roots scan every member (final touches)

Two changes to how monorepos are scanned:

- **Members aren't dependencies.** On npm and yarn workspaces, each workspace member appeared in the scan as a package, so a member without a `license` field was reported as having no license and failed the check. On pnpm, the same happened to a member that another member depends on (`workspace:*`). Members are the project's own code, so they're no longer checked. Their dependencies still are.
- **pnpm workspace roots scan every member.** Running license-cop in the root of a pnpm workspace only looked at the root's own dependencies, so a root with none of its own (the usual shape) scanned nothing and passed. It now scans the dependencies of every member. npm and yarn already did.

- **Why:** the first was noise that forced people to give private packages a license, or to allow-list them by name; the second was a silent false pass.
- **Affected:** pnpm workspaces, whose runs can now fail on a member's dependency that has a forbidden or missing license; and npm, yarn and pnpm workspaces that allow-listed a member in `packages`, or gave a member a license only to get past the check, which can now be undone.
- **Migrate:** fix or allow-list whatever the check now reports. Remove any allow-list entry that was only there for a member.

### Projects that aren't installed now fail instead of passing (final touches)

Running license-cop in a project whose dependencies haven't been installed (no `node_modules`) used to find nothing and print "Done! No issues found" with exit code 0, whichever package manager it uses. It now fails with exit code 1 and asks for an install (for example `Run 'npm install' first`). A project that declares no dependencies to check still passes, and so does a `--dev-dependencies only` run of a project with no dev dependencies.

- **Why:** an empty scan is indistinguishable from a clean one, so a CI job that forgot its install step passed no matter what the dependencies were.
- **Affected:** CI jobs and scripts that run license-cop before installing. They were passing without checking anything. It also applies to a workspace member scanned on its own under npm or yarn, where the dependencies are hoisted to the root: run license-cop from the workspace root instead.
- **Migrate:** install before running license-cop, or run it from the workspace root.

### `init` no longer overwrites an existing config (final touches)

`license-cop init` used to write `.licenses.json` unconditionally, replacing any file already there. It now fails with exit code 1, naming the file, if the project already has a config that license-cop would use, in any of the places it reads one from (any spelling and format: `.licenses.*`, `.licences.*`, `.licensesrc.*`, `.config/…`, `licenses.config.*`, or a `licensecop` key in `package.json`). A config that can't be loaded also refuses, with the reason. An empty file isn't a config, so it doesn't. Nothing is written.

- **Why:** re-running `init` silently destroyed the user's own allow-list.
- **Affected:** scripts that run `license-cop init` on every run (for example to regenerate the default config) and relied on it replacing the file.
- **Migrate:** delete the existing config first, or only run `init` when there isn't one.
