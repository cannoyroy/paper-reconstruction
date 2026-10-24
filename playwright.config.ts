import { defineConfig, devices } from "@playwright/test";
const baseURL = `http://127.0.0.1:4173${process.env.BASE_PATH || "/"}`;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  timeout: 30000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm preview",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
