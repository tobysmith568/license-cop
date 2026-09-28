# @license-cop/core

The license-checking engine behind [license-cop](https://www.npmjs.com/package/license-cop). Most people want the `license-cop` CLI; use this package to check licenses programmatically.

```ts
import { checkLicenses } from "@license-cop/core";

const result = await checkLicenses({
  allowedLicenses: ["MIT", "ISC"],
  allowedPackages: [],
  workingDirectory: "./my-project"
});

if (result.noLicenses.size > 0 || result.forbiddenLicenses.size > 0) {
  // ...
}
```

`checkLicenses` scans the dependencies of the project in `workingDirectory` (npm, yarn and pnpm are supported) and returns the packages grouped by outcome. Pass `includeDevDependencies` or `devDependenciesOnly` to control which dependencies are scanned, and `onVerbose` to receive progress messages.

`checkLicenses` doesn't read any config files; it only does what the options it's given say. Reading a `.licenses.json` (and anything it `extends`) is a feature of the `license-cop` command, which builds these options from that file and its command-line flags.

License-cop itself is licensed under the [ISC license](https://github.com/tobysmith568/license-cop/blob/main/LICENSE.md).
