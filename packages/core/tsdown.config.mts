import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "esm",
  dts: true,
  // package.json already says "type": "module" — no need for the unambiguous .mjs
  // extension tsdown defaults to on the node platform.
  fixedExtension: false,
  sourcemap: true,
  clean: true
});
