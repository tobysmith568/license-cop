import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { bin: "src/bin.ts" },
  format: "cjs",
  dts: false,
  // package.json already says "type": "commonjs" — no need for the unambiguous .cjs
  // extension tsdown defaults to on the node platform.
  fixedExtension: false,
  sourcemap: true,
  clean: true
});
