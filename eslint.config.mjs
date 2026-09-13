import nxEslintPlugin from "@nx/eslint-plugin";
import tobysmith568 from "@tobysmith568/eslint-config";

export default [
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"] },
  ...tobysmith568.recommended,
  // Nx-specific pieces, carried forward from the legacy .eslintrc.json config as-is.
  // Dropped once 1.5 (nx -> turborepo) lands, see migration.md.
  ...nxEslintPlugin.configs["flat/base"],
  ...nxEslintPlugin.configs["flat/typescript"],
  ...nxEslintPlugin.configs["flat/javascript"],
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: "*",
              onlyDependOnLibsWithTags: ["*"]
            }
          ]
        }
      ]
    }
  }
];
