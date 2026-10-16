import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { claimJob, runJob } from "../apps/worker/src/worker.js";
import { EvidenceStore } from "../packages/shared/src/evidence.js";
import { ADMIN_URL, FIXTURE_ORIGIN, createTestDb, type TestDb } from "./helpers/test-db.js";

// The worker only ever sees jobs whose payment the API already settled. These tests insert that
// settled state directly so the browser path can be exercised without spending; they never touch
// a submission route.
const describeDb = ADMIN_URL ? describe : describe.skip;

describeDb("worker (integration, real Chromium against deployed fixtures)", () => {
  let t: TestDb;
  let browser: Browser;
  let evidence: EvidenceStore;

  beforeAll(async () => {
    t = await createTestDb("aislerun_worker");
    browser = await chromium.launch();
    evidence = new EvidenceStore(await mkdtemp(join(tmpdir(), "aislerun-worker-evidence-")));
  });

  afterAll(async () => {
    await browser?.close();
    await t?.drop();
  });

  async function settledJob(version: string, overrides: { status?: string; leaseExpired?: boolean; attempts?: number } = {}) {
    const quoteId = randomUUID();
    const paymentId = randomUUID();
    const id = randomUUID();
    const url = `${FIXTURE_ORIGIN}/v/${version}/products/cup`;
    await t.db.query(
      "INSERT INTO quotes (id, target_id, normalized_product_url, profile, viewports_json, price_amount_atomic, asset, network, expires_at, request_hash) VALUES ($1, $2, $3, 'shopify_checkout_entry_v1', '[\"mobile\",\"desktop\"]', 50000, 'usdc', 'eip155:8453', now() + interval '10 minutes', 'h')",
      [quoteId, version, url],
    );
    await t.db.query("INSERT INTO payments (id, quote_id, provider, network, payer, state, amount_atomic, fingerprint) VALUES ($1, $2, 'x402', 'eip155:8453', '0xabc', 'SETTLED', 50000, $3)", [paymentId, quoteId, `fp-${paymentId}`]);
    await t.db.query(
      `INSERT INTO inspections (id, quote_id, payment_id, idempotency_key, intent_hash, payer, target_id, product_url, profile, status, report_access_key_hash, queued_at, attempt_count, lease_expires_at)
       VALUES ($1, $2, $3, $4, 'i', '0xabc', $5, $6, 'shopify_checkout_entry_v1', $7, 'x', now(), $8, $9)`,
      [id, quoteId, paymentId, `key-${id}`, version, url, overrides.status ?? "QUEUED", overrides.attempts ?? 0, overrides.leaseExpired ? new Date(Date.now() - 1000) : null],
    );
    return id;
  }

  async function runNext() {
    const job = await claimJob(t.db, "test-worker");
    expect(job).not.toBeNull();
    await runJob({ db: t.db, evidence }, job!, browser, "test-worker");
    const row = (await t.db.query("SELECT status, overall_verdict FROM inspections WHERE id = $1", [job!.id])).rows[0];
    const runs = (await t.db.query("SELECT viewport, verdict, blocker FROM viewport_runs WHERE inspection_id = $1 ORDER BY viewport", [job!.id])).rows;
    return { id: job!.id, ...row, runs: Object.fromEntries(runs.map((r) => [r.viewport, [r.verdict, r.blocker]])) };
  }

  it.each([
    ["fixture-healthy-v1", "PASS", { desktop: ["PASS", null], mobile: ["PASS", null] }],
    ["fixture-mobile-cart-broken-v1", "FAIL", { desktop: ["PASS", null], mobile: ["FAIL", "ADD_TO_CART_NO_EFFECT"] }],
    ["fixture-fixed-v2", "PASS", { desktop: ["PASS", null], mobile: ["PASS", null] }],
    ["fixture-bot-check-v1", "INCONCLUSIVE", { desktop: ["INCONCLUSIVE", "BROWSER_BLOCKED"], mobile: ["INCONCLUSIVE", "BROWSER_BLOCKED"] }],
  ])("FR-06/07/08: classifies %s as %s", async (version, verdict, runs) => {
    // #given a settled job for the fixture
    await settledJob(version);
    // #when the worker runs it
    const result = await runNext();
    // #then the stored verdicts match the fixture's known state
    expect({ status: result.status, verdict: result.overall_verdict, runs: result.runs }).toEqual({ status: verdict === "INCONCLUSIVE" ? "INCONCLUSIVE" : "COMPLETED", verdict, runs });
  }, 120_000);

  it("FR-09: stores evidence that belongs to the run, with hashes and sizes", async () => {
    await settledJob("fixture-healthy-v1");
    const { id } = await runNext();
    const { rows } = await t.db.query("SELECT a.kind, a.bytes, a.sha256, a.object_key, v.viewport FROM artifacts a JOIN viewport_runs v ON v.id = a.viewport_run_id WHERE a.inspection_id = $1", [id]);
    const kinds = new Set(rows.map((r) => `${r.viewport}:${r.kind}`));
    expect({ allScoped: rows.every((r) => r.object_key.startsWith(`${id}/`) && Number(r.bytes) > 0 && r.sha256.length === 64), kinds: [...kinds].sort() }).toEqual({
      allScoped: true,
      kinds: ["desktop:screenshot", "desktop:trace", "desktop:video", "mobile:screenshot", "mobile:trace", "mobile:video"],
    });
  }, 120_000);

  it("FR-12: a job whose worker died is re-run once on the same payment, then closed as FAILED_INTERNAL", async () => {
    // #given one job stuck mid-run with one prior attempt, and one stuck after two attempts
    const recoverable = await settledJob("fixture-healthy-v1", { status: "RUNNING_MOBILE", leaseExpired: true, attempts: 1 });
    const exhausted = await settledJob("fixture-healthy-v1", { status: "RUNNING_DESKTOP", leaseExpired: true, attempts: 2 });
    // #when the worker claims work
    const job = await claimJob(t.db, "test-worker");
    // #then the recoverable job is re-run (no new payment row) and the exhausted one is a service failure, not a store verdict
    const states = (await t.db.query("SELECT id, status, overall_verdict, error_code FROM inspections WHERE id = ANY($1)", [[recoverable, exhausted]])).rows;
    const payments = Number((await t.db.query("SELECT count(*) FROM payments p JOIN inspections i ON i.payment_id = p.id WHERE i.id = $1", [recoverable])).rows[0].count);
    expect({
      claimed: job?.id,
      recovered: job?.recovered,
      exhausted: states.find((s) => s.id === exhausted),
      payments,
    }).toEqual({
      claimed: recoverable,
      recovered: true,
      exhausted: { id: exhausted, status: "FAILED_INTERNAL", overall_verdict: null, error_code: "INTERNAL_FAILURE" },
      payments: 1,
    });
    await runJob({ db: t.db, evidence }, job!, browser, "test-worker");
  }, 120_000);

  it("never claims a job whose payment has not settled", async () => {
    const id = await settledJob("fixture-healthy-v1", { status: "AWAITING_SETTLEMENT" });
    await t.db.query("UPDATE inspections SET status = 'COMPLETED' WHERE id <> $1 AND status = 'QUEUED'", [id]);
    expect(await claimJob(t.db, "test-worker")).toBeNull();
  });
});
