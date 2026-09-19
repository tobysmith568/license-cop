import tobysmith568 from "@tobysmith568/eslint-config";
import typescriptParser from "@typescript-eslint/parser";
import astro from "eslint-plugin-astro";

const astroConfigs = astro.configs["flat/recommended"].map(config => {
  const isAstroFileConfig = config.files?.includes("**/*.astro") ?? false;

  if (!isAstroFileConfig) {
    return config;
  }

  return {
    ...config,
    files: ["apps/website/**/*.astro"],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: { ...config.languageOptions.parserOptions, parser: typescriptParser }
    }
  };
});

export default [
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "**/.astro/**"] },
  ...tobysmith568.recommended,
  ...astroConfigs
];
