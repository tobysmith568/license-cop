# Changelog

All notable changes to `license-cop` and `@license-cop/core` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0]

### Breaking Changes

- **The programmatic API moved to `@license-cop/core`.** `license-cop` is now bin-only; `checkLicenses`, `LicenseCopOptions` and the result types (`CheckLicensesResult`, `AllowedPackage`, `LicensedPackage`, `NoLicenseResult`, `ForbiddenLicenseResult`) are no longer exported from it. Run `npm install @license-cop/core` and import from there instead. The exports are unchanged, only the package.
- **The published file layout changed.** The CLI entry point is now `dist/bin.js` (was `src/bin/license-cop`), and internal files are bundled into `dist/` instead of shipped one file per module. Invoke the command by name (`npx license-cop`, an npm script, or `node_modules/.bin/license-cop`) rather than by path, and replace any deep imports from `license-cop/src/...` with the public exports of `@license-cop/core`.
- **Both packages are now ESM-only.** There is no CommonJS build. `require("@license-cop/core")` no longer works; switch to `import`, or `await import("@license-cop/core")` if the caller can't move off CommonJS. The CLI itself is unaffected, however it's invoked.
- **`--init` flag removed.** Run `license-cop init` instead; it does exactly the same thing.
- **`-D`, `--include-dev` and `--dev-only` replaced by `--dev-dependencies <mode>`.** `-D`/`--include-dev` becomes `--dev-dependencies include`; `--dev-only` becomes `--dev-dependencies only`. The config file's `includeDevDependencies` and `devDependenciesOnly` keys are unchanged.
- **`init` no longer overwrites an existing config.** It now fails and names the file if the project already has one (any supported name/location, or a `licensecop` key in `package.json`). Delete the existing config first if you want to regenerate it.
- **Unexpected errors no longer print a raw stack trace.** They print `error: <message>` on stderr and exit 1. Pass `--verbose` to get the stack trace back.
- **The failure report now goes entirely to stderr.** The `Found the following issues...` header used to go to stdout while the details went to stderr, splitting the report across streams. Read stderr (or both streams), or rely on the exit code, which is unchanged (1 when there are issues).
- **A project with no installed dependencies now fails instead of passing.** Previously an unscanned project (no `node_modules`) reported success. Install dependencies before running `license-cop`. For a workspace member under npm or yarn, where dependencies are hoisted to the root, run it from the workspace root instead.
- **Workspace members are no longer scanned as if they were dependencies.** A member without a `license` field used to fail the check; members are now treated as the project's own code and skipped (their dependencies are still checked). You can remove any allow-list entry you added only to work around this.
- **pnpm workspace roots now scan every member's dependencies**, not just the root's own. This can surface dependencies, and licenses, that the check previously never looked at.
- **pnpm: `--dev-dependencies only` now actually scans dev dependencies.** It previously scanned nothing on pnpm and always passed.
- **pnpm: optional dependencies are now scanned**, matching npm and yarn. An installed optional dependency with a forbidden or missing license can now fail the check where it previously passed.
- **A child config now inherits the parent's dev-dependency settings through `extends`**, when it doesn't set them itself, instead of silently resetting them to `false`. If you rely on a child not scanning dev dependencies even though its parent does, set `includeDevDependencies`/`devDependenciesOnly` to `false` explicitly in the child.
- **`OR` license expressions are now satisfied by either side.** A package licensed e.g. `(MIT OR GPL-3.0)` now passes if either license is allowed, not only if both are. You can remove any allow-list entry you added only to work around the old, stricter behaviour.
