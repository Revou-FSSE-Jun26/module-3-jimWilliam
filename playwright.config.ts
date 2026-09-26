import { defineConfig, devices } from "@playwright/test";

// `PLAYWRIGHT_BASE_URL=https://... npx playwright test` runs the suite against production.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8100";
const isLocal = /localhost|127\.0\.0\.1/.test(baseURL);

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false, // specs share one in-memory store; keep runs deterministic
  workers: 1,
  retries: isLocal ? 0 : 1, // a cold serverless start can make the very first request slow
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Locally, start the app if it is not already running. Against production there is nothing to start.
  webServer: isLocal
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
