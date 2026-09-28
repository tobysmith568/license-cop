# Running the tests

Run them through the package scripts or turbo, not with a bare `bun test`:

- `bunx turbo run test` runs every package's unit tests (and builds what they need first).
- `bunx turbo run e2e --filter=cli-e2e` runs the real-install suite. It needs the CLI built and the fixture packages packed, which turbo does for you.
- Inside one package, `bun run test` (or `bun run e2e`).

Every script passes `--isolate`, which runs each test file in a fresh global object. That matters here because several specs replace modules with `mock.module`, and without `--isolate` a mock in one file leaks into every file that runs after it. A bare `bun test` therefore shows dozens of spurious failures in `packages/core`. `--isolate` can only be given as a command-line flag: `bunfig.toml`'s `[test]` section doesn't accept it (checked on bun 1.4.0), so there is no config to put it in.

Set `KEEP_TEMP=1` to keep the temp directories the tests create, which helps when a failing test needs inspecting; their paths are logged.
