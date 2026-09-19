# Breaking changes

Source material for the release notes of the next major version. This file only lists changes that can break something a user of `license-cop` already has: their scripts, CI, config files or code. Refactors, tooling changes, fixes and additive features don't belong here, and neither do changes nobody could reasonably depend on (help wording, error message text).

The baseline for "what users have today" is the published `license-cop@1.9.0`. Each entry says what changed, who is affected, and how to migrate.

Status is **landed** (in the working branch) or **pending** (raised in [migration.md](migration.md) but not yet decided or implemented, so it may not happen at all).

## Landed

### The programmatic API moved to `@license-cop/core` (2.1)

`license-cop@1.9.0` publishes `main: ./src/index.js` and `types: ./src/index.d.ts`, so `import { checkLicenses } from "license-cop"` works today. The package is now bin-only and no longer resolves as a library. The engine lives in a new package, `@license-cop/core`.

- **Affected:** anyone importing `checkLicenses`, `LicenseCopOptions` or the result types from `license-cop` in their own code. The API was never documented on the website or in the README, but it was published, so assume someone uses it.
- **Migrate:** `npm install @license-cop/core` and import from `@license-cop/core` instead. The exports are the same (`checkLicenses`, `LicenseCopOptions` and the result types: `CheckLicensesResult`, `AllowedPackage`, `LicensedPackage`, `NoLicenseResult`, `ForbiddenLicenseResult`).

### The published file layout changed (2.1, 1.5)

The CLI entry point moved from `src/bin/license-cop` to `dist/bin.js`, and the rest of the package's internal files (`src/lib/**`, `src/index.js`) are now bundled into `dist/` instead of shipped one file per module.

- **Affected:** anyone who invokes the file by its path (for example `node node_modules/license-cop/src/bin/license-cop` in a script or CI step), or who deep-imports from `license-cop/src/...`.
- **Migrate:** run the command by name instead: `npx license-cop`, an npm script, or `node_modules/.bin/license-cop`. None of those change. Replace deep imports with the public exports of `@license-cop/core`.

## Pending

### Command-line flags (2.3)

Not yet decided; each of these is a breaking change if it goes ahead, and would move to **Landed** with a migration note.

- **`--init` flag removed** (recommended): use `license-cop init` instead. Affects scripts that run `license-cop --init`.
- **`-D, --include-dev` and `--dev-only` replaced by one flag** (recommended: `--dev-dependencies <include|only>`). Affects scripts and CI steps that pass either flag.
