import { defineConfig, devices } from "@playwright/test";

// `PLAYWRIGHT_BASE_URL=https://... npx playwright test` runs the suite against production.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8100";
const isLocal = /localhost|127\.0\.0\.1/.test(baseURL);
// Locally the suite runs against its own Flask API and database (scripts/e2e-backend.mjs), so
// it can reseed freely without touching your development data.
const e2eBackend = `http://localhost:${process.env.E2E_BACKEND_PORT ?? "5055"}`;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false, // specs share one database; keep runs deterministic
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
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "Microsoft Edge", use: { ...devices["Desktop Edge"] } }
  ],
  // Locally, start the Flask API (migrated + seeded) and the app pointed at it, unless they are
  // already running. Against production there is nothing to start.
  webServer: isLocal
    ? [
        {
          command: "node scripts/e2e-backend.mjs --serve",
          url: `${e2eBackend}/health`,
          reuseExistingServer: true,
          timeout: 180_000,
        },
        {
          command: "npm run dev",
          env: { BACKEND_URL: e2eBackend },
          url: baseURL,
          reuseExistingServer: true,
          timeout: 180_000,
        },
      ]
    : undefined,
});
