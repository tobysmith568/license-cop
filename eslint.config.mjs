import recommended from "@tobysmith568/eslint-config";
import astro from "@tobysmith568/eslint-config/astro";
import browser from "@tobysmith568/eslint-config/browser";
import node from "@tobysmith568/eslint-config/node";
import playwright from "@tobysmith568/eslint-config/playwright";
import prettier from "@tobysmith568/eslint-config/prettier";
import test from "@tobysmith568/eslint-config/test";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "**/.astro/**"] },
  recommended,
  node,
  { files: ["apps/website/**"], extends: [browser] },
  { files: ["**/*.spec.ts"], extends: [test] },
  { files: ["apps/website-e2e/**/*.spec.ts"], extends: [playwright] },
  astro,
  prettier
]);
