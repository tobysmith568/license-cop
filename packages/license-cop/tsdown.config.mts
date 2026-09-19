import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", bin: "src/bin.ts" },
  format: "cjs",
  tsconfig: "tsconfig.lib.json",
  dts: { tsconfig: "tsconfig.lib.json" },
  // package.json already says "type": "commonjs" — no need for the unambiguous .cjs
  // extension tsdown defaults to on the node platform.
  fixedExtension: false,
  sourcemap: true,
  clean: true
});
