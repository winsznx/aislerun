import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { runViewportJourney } from "../packages/inspection/src/journey.js";

// Runs the real journey against one deployed fixture version without the API or payments.
// Usage: tsx scripts/smoke-fixture.ts fixture-mobile-cart-broken-v1
const version = process.argv[2] ?? "fixture-healthy-v1";
const origin = process.env.FIXTURE_ORIGIN ?? "https://aislerun-fixtures.vercel.app";
const target = { id: "smoke", origin, productPathPrefix: "/v/", label: "smoke", fixtureVersion: version };

const browser = await chromium.launch();
const workDir = await mkdtemp(join(tmpdir(), "aislerun-smoke-"));
for (const viewport of ["mobile", "desktop"] as const) {
  const outcome = await runViewportJourney({
    browser,
    viewport,
    productUrl: `${origin}/v/${version}/products/cup`,
    target,
    workDir,
    emit: async (e) => console.log(`  ${e.viewport} ${e.type} ${e.step ?? ""} ${e.observed ?? e.nextAction ?? ""}`),
  });
  console.log(`${viewport}: ${outcome.verdict} blocker=${outcome.blocker} attempts=${outcome.attempts} artifacts=${outcome.artifacts.length} console=${JSON.stringify(outcome.consoleErrors)}`);
}
await browser.close();
console.log(`evidence in ${workDir}`);
