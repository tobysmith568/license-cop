# LicenseCop

Yet another license checker tool for your dependencies; focused on simplicity.

<a href="https://www.npmjs.com/package/license-cop">
  <img alt="npm" src="https://img.shields.io/npm/v/license-cop?logo=npm">
</a>

## Setup

Install license-cop

```bash
npm install license-cop --save-dev
```

Make a config file

```bash
npx license-cop --init
```

Run license-cop

```bash
npx license-cop
```

The `license-cop` command will use an exit code of 0 if all your dependencies conform to the settings in your config file.

## Config File

By default the `--init` flag will make a `.licenses.json` file, however you can use many different variations of file name and file type including:

<!--- cspell:disable-next-line --->

- Spelling `licenses` as `licences`
- Ending `licenses` with `rc`
- Having the file be in a `.config/` directory
- Using: `.json`, `.jsonc`, `.json5`, `.yaml`, `.yml`, `.js`, or `.cjs`
- Using a `licensecop` key in a `package.json` file

### Config file options

#### `licenses`

Specify all of the [SPDX license codes](https://spdx.org/licenses/) that you're allowing in your dependency tree. E.g.

```json
{
  "licenses": ["MIT", "ISC", "Apache-2.0"]
}
```

#### `packages`

Specify all of the packages you're allowing, no matter what the license is. You can optionally lock packages by npm version ranges. E.g.

```json
{
  "packages": ["lodash", "axios@^2.0.0", "react@<16"]
}
```

#### `extends`

Specify another license-cop config file that this file should extend.

```json
{
  "extends": "@license-cop/permissive"
}
```

Values can be:

- The name of an installed npm package (optionally prefixed with `npm:`) that contains a license-cop config file.  
  `@license-cop/permissive`  
  `npm:@license-cop/permissive`

> [@license-cop/permissive](https://www.npmjs.com/package/@license-cop/permissive) is a base config provided by us containing a curated list of permissive licenses. We think it's a good starting point for all configs!

- The name of a public github repository (prefixed with `github:`) that contains a license-cop config file. This currently only supports config files called exactly `.licenses.json`.  
  `github:tobysmith568/license-cop-config`

- A URL to a license-cop config file. Currently this only supports json config files.  
  `https://raw.githubusercontent.com/tobysmith568/license-cop-config/main/license-cop.json`

**Caveats**

If you extend a remote file, and that in-turn extends an npm package, then you're going to need to have that npm package installed locally. They're not resolved dynamically from npmjs.com.

#### `includeDevDependencies`

`false` by default.  
Set to `true` to make license-cop also check your dev-dependencies.

#### `devDependenciesOnly`

`false` by default.  
Set to `true` to make license-cop only check your dev-dependencies.

## CI/CD Example (GitHub Actions)

Running license-cop as a part of your CI process is a great way to catch issues before they land in your main branch.

Below is an example of how you can run license-cop in its own GitHub Action job for all PRs targetting main:

```yaml
name: Check Licenses

on:
  pull_request:
    branches:
      - main

jobs:
  licenses:
    name: Check Licenses

    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run License-Cop
        run: npx license-cop
```

The Action above will fail if any of your node_modules have a license that isn't listed in your license-cop config file.

## License

License-cop itself is licensed under the [ISC license](https://github.com/tobysmith568/license-cop/blob/main/LICENSE.md).
