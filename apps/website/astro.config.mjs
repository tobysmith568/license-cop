import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import directive from "remark-directive";
import admonitionsPlugin from "./plugins/admonitions.mjs";

export default defineConfig({
  outDir: "../../dist/apps/website",
  site: "https://license-cop.tobythe.dev",

  integrations: [react(), sitemap()],

  markdown: {
    remarkPlugins: [directive, admonitionsPlugin],
    shikiConfig: {
      theme: "light-plus",
      wrap: true
    }
  }
});
