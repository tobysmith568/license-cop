import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "cjs",
  dts: true,
  // package.json already says "type": "commonjs" — no need for the unambiguous .cjs
  // extension tsdown defaults to on the node platform.
  fixedExtension: false,
  clean: true
});
