import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Load .env so `npm test` runs the Postgres-backed suites after `cp .env.example .env`.
// Variables already set in the environment (as in CI) take precedence.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  test: {
    env: { LOG_LEVEL: "silent" },
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
