import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/e2e",
  fullyParallel: false,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  retries: process.env["CI"] ? 2 : 0,
  use: {
    baseURL: "http://localhost:4321",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } }
  ],
  webServer: {
    command: "bunx turbo run serve --filter=website",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env["CI"]
  }
});
