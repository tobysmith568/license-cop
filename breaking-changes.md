# Breaking changes

Running list of user-facing breaking changes for the next major release, used to write the release notes. Add an entry whenever a change alters what an existing user of the CLI, the config file, or the programmatic API would see. Internal refactors and tooling changes (bun, turborepo, Playwright, CI) don't belong here.

Each entry says what changed, who is affected, and how to migrate. Status is **landed** (in the working branch) or **planned** (decided in [migration.md](migration.md) but not yet implemented; wording may change).

## Landed

### The `license-cop` package no longer exports a programmatic API (2.1)

`license-cop` is now bin-only: it has no `main`, `types` or `exports`, so `import { checkLicenses } from "license-cop"` no longer resolves. The engine moved to a new package, `@license-cop/core`.

- **Affected:** anyone importing `checkLicenses`, `LicenseCopOptions` or the result types from `license-cop` in their own code.
- **Migrate:** `npm install @license-cop/core` and import from `@license-cop/core` instead. The exports are the same (`checkLicenses`, `LicenseCopOptions` and the result types: `CheckLicensesResult`, `AllowedPackage`, `LicensedPackage`, `NoLicenseResult`, `ForbiddenLicenseResult`).
- **Not affected:** the `license-cop` command, its flags and the config file are unchanged by this move.

## Planned

### Command-line flags (2.3)

Final flag set is still to be decided one flag at a time; recommendations from the plan are below.

- **`--init` flag removed** (recommended): use the `init` subcommand, `license-cop init`, which is the only form the docs and the CLI's own output mention.
- **`-D, --include-dev` and `--dev-only` replaced by one flag** (recommended: `--dev-dependencies <include|only>`, default prod-only). Anyone using either flag in scripts or CI needs to switch.
- **`-v`/`--version`:** already non-functional in the current release (`unknown option`), so a working `--version` is a fix rather than a break; noted here in case the spelling changes.

### Hand-written `--help` and argument parsing (2.2)

Commander is replaced by `node:util.parseArgs` plus zod. The set of accepted flags is preserved in 2.2 (changes are 2.3, above), but the `--help` text and error messages for bad command lines will read differently, so anything parsing them is affected. Exit code for a usage error is currently planned to stay `1`; if it moves to `2`, list it here.

### Config file keys (2.3, only if the dev-dependency flags change the config too)

Default is to leave `includeDevDependencies` and `devDependenciesOnly` in `.licenses.json` untouched. If that changes, document the old and new keys and whether the old ones keep working.

## Not breaking (for reference)

- `@license-cop/core` gains an optional `onVerbose` callback on `LicenseCopOptions`. It's additive, and library use stays silent by default.
- The CLI's behaviour for the default command, `init`, verbose output and exit codes is intended to be identical across 2.1 and 2.2; the e2e suite is the check on that.
