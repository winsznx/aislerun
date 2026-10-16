import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../apps/api/src/app.js";
import { createResourceServer } from "../apps/api/src/payments.js";
import type { Config } from "../packages/shared/src/config.js";
import type { Db } from "../packages/shared/src/db.js";
import { EvidenceStore } from "../packages/shared/src/evidence.js";
import { ADMIN_URL, FIXTURE_ORIGIN, createTestDb, type TestDb } from "./helpers/test-db.js";

// Runs against the real local Postgres, the real x402 middleware and the real PayAI facilitator.
// No payment is ever settled: the only signed payment comes from a freshly generated, unfunded key.
const describeDb = ADMIN_URL ? describe : describe.skip;

describeDb("API (integration)", () => {
  let db: Db;
  let server: Server;
  let base: string;
  let t: TestDb;

  beforeAll(async () => {
    t = await createTestDb("aislerun_api");
    db = t.db;
    const config: Config = {
      PORT: 0,
      SERVICE_BASE_URL: "http://127.0.0.1",
      WEB_BASE_URL: "http://127.0.0.1",
      DATABASE_URL: t.url,
      PAYMENT_RECEIVER: "0x50b174FAF12a7c7D6618Ac65D71DF613fEa0F57f",
      X402_NETWORK: "eip155:8453",
      X402_FACILITATOR_URL: "https://facilitator.payai.network",
      INSPECTION_PRICE_USD: "0.05",
      REPORT_TOKEN_SECRET: "t".repeat(64),
      EVIDENCE_DIR: await mkdtemp(join(tmpdir(), "aislerun-test-evidence-")),
      FIXTURE_ORIGIN,
      WORKER_ENABLED: "false",
      BUILD_VERSION: "test",
    };
    const resourceServer = createResourceServer({ network: config.X402_NETWORK, facilitatorUrl: config.X402_FACILITATOR_URL, receiver: config.PAYMENT_RECEIVER, priceUsd: config.INSPECTION_PRICE_USD });
    const app = createApp({ config, db, evidence: new EvidenceStore(config.EVIDENCE_DIR), resourceServer });
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    server?.close();
    await t?.drop();
  });

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

  const productUrl = (version: string) => `${FIXTURE_ORIGIN}/v/${version}/products/cup`;

  async function quote(version = "fixture-healthy-v1") {
    const res = await post("/v1/quotes", { product_url: productUrl(version), authorized_target_id: version, profile: "shopify_checkout_entry_v1" });
    expect(res.status).toBe(201);
    return (await res.json()) as { quote_id: string; price: { amount_atomic: string; network: string } };
  }

  const count = async (table: string) => Number((await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count);

  it("FR-01: refuses an unauthorized origin at quote time without creating anything", async () => {
    const res = await post("/v1/quotes", { product_url: "https://example.com/products/cup", authorized_target_id: "fixture-healthy-v1", profile: "shopify_checkout_entry_v1" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("TARGET_NOT_AUTHORIZED");
    expect(await count("quotes")).toBe(0);
  });

  it("FR-02: binds a concrete price, network and expiry to the quoted target", async () => {
    const q = await quote();
    expect(q.price).toMatchObject({ amount_atomic: "50000", network: "eip155:8453" });
    const row = (await db.query("SELECT normalized_product_url, expires_at FROM quotes WHERE id = $1", [q.quote_id])).rows[0];
    expect(row.normalized_product_url).toBe(productUrl("fixture-healthy-v1"));
    expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("FR-02: refuses a request that does not match its quote, before any challenge", async () => {
    const q = await quote();
    const res = await post("/v1/inspections", { quote_id: q.quote_id, product_url: productUrl("fixture-fixed-v2"), authorized_target_id: "fixture-fixed-v2", profile: "shopify_checkout_entry_v1", idempotency_key: "mismatch-0001" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("QUOTE_SCOPE_MISMATCH");
  });

  it("FR-02: refuses an expired quote with 410 and no payment challenge", async () => {
    const q = await quote();
    await db.query("UPDATE quotes SET expires_at = now() - interval '1 second' WHERE id = $1", [q.quote_id]);
    const res = await post("/v1/inspections", { quote_id: q.quote_id, product_url: productUrl("fixture-healthy-v1"), authorized_target_id: "fixture-healthy-v1", profile: "shopify_checkout_entry_v1", idempotency_key: "expired-0001" });
    expect(res.status).toBe(410);
    expect(res.headers.get("payment-required")).toBeNull();
  });

  it("FR-04: an unsigned paid request gets an SDK-native x402 v2 challenge and creates no job", async () => {
    const q = await quote();
    const res = await post("/v1/inspections", { quote_id: q.quote_id, product_url: productUrl("fixture-healthy-v1"), authorized_target_id: "fixture-healthy-v1", profile: "shopify_checkout_entry_v1", idempotency_key: "unsigned-0001" });
    expect(res.status).toBe(402);
    const challenge = new x402HTTPClient(new x402Client()).getPaymentRequiredResponse((n) => res.headers.get(n));
    expect(challenge.x402Version).toBe(2);
    expect(challenge.accepts[0]).toMatchObject({ scheme: "exact", network: "eip155:8453", amount: "50000", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" });
    expect(await count("inspections")).toBe(0);
  });

  it("FR-11: a validly signed payment from an unfunded wallet is rejected by the facilitator and never creates a job", async () => {
    const q = await quote();
    const body = { quote_id: q.quote_id, product_url: productUrl("fixture-healthy-v1"), authorized_target_id: "fixture-healthy-v1", profile: "shopify_checkout_entry_v1", idempotency_key: "unfunded-0001" };
    const challengeRes = await post("/v1/inspections", body);
    const account = privateKeyToAccount(generatePrivateKey());
    const client = new x402Client();
    registerExactEvmScheme(client, { signer: toClientEvmSigner(account) });
    const http = new x402HTTPClient(client);
    const payload = await http.createPaymentPayload(http.getPaymentRequiredResponse((n) => challengeRes.headers.get(n)));
    const paid = await post("/v1/inspections", body, http.encodePaymentSignatureHeader(payload));
    expect(paid.status).toBe(402);
    expect(await count("inspections")).toBe(0);
    expect(await count("payments")).toBe(0);
  }, 30_000);

  it("FR-05: a replay of an accepted intent returns the original job without a new challenge; a different key conflicts", async () => {
    const q = await quote();
    const paymentId = randomUUID();
    const inspectionId = randomUUID();
    // Simulates the state a settled PayBox payment leaves behind, to exercise the replay path only.
    await db.query("INSERT INTO payments (id, quote_id, provider, network, payer, state, amount_atomic, fingerprint) VALUES ($1, $2, 'x402', 'eip155:8453', '0xabc', 'SETTLED', 50000, $3)", [paymentId, q.quote_id, `fp-${paymentId}`]);
    const body = { quote_id: q.quote_id, product_url: productUrl("fixture-healthy-v1"), authorized_target_id: "fixture-healthy-v1", profile: "shopify_checkout_entry_v1", idempotency_key: "replay-0001" };
    const { sha256Hex } = await import("../packages/shared/src/tokens.js");
    const intent = sha256Hex(JSON.stringify([body.quote_id, body.product_url, body.authorized_target_id, body.profile, null]));
    await db.query(
      "INSERT INTO inspections (id, quote_id, payment_id, idempotency_key, intent_hash, payer, target_id, product_url, profile, status, report_access_key_hash) VALUES ($1, $2, $3, $4, $5, '0xabc', 'fixture-healthy-v1', $6, 'shopify_checkout_entry_v1', 'QUEUED', 'x')",
      [inspectionId, q.quote_id, paymentId, body.idempotency_key, intent, body.product_url],
    );
    const before = await count("inspections");
    const replay = await post("/v1/inspections", body);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ inspection_id: inspectionId, replayed: true });
    const conflict = await post("/v1/inspections", { ...body, idempotency_key: "replay-0002" });
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).code).toBe("IDEMPOTENCY_CONFLICT");
    expect(await count("inspections")).toBe(before);
  });

  it("refuses with RATE_LIMITED, before any payment challenge, when the queue is full", async () => {
    // #given ten jobs already waiting
    const q0 = await quote();
    const paymentId = randomUUID();
    await db.query("INSERT INTO payments (id, quote_id, provider, network, payer, state, amount_atomic, fingerprint) VALUES ($1, $2, 'x402', 'eip155:8453', '0xq', 'SETTLED', 50000, $3)", [paymentId, q0.quote_id, `fp-${paymentId}`]);
    const filler: string[] = [];
    for (let i = 0; i < 10; i++) {
      const qi = await quote();
      const id = randomUUID();
      filler.push(id);
      await db.query(
        "INSERT INTO inspections (id, quote_id, payment_id, idempotency_key, intent_hash, payer, target_id, product_url, profile, status, report_access_key_hash) VALUES ($1, $2, $3, $4, $5, '0xq', 'fixture-healthy-v1', 'u', 'shopify_checkout_entry_v1', 'QUEUED', 'x')",
        [id, qi.quote_id, paymentId, `fill-${i}`, `intent-${i}`],
      );
    }
    // #when a new paid request arrives
    const q = await quote();
    const res = await post("/v1/inspections", { quote_id: q.quote_id, product_url: productUrl("fixture-healthy-v1"), authorized_target_id: "fixture-healthy-v1", profile: "shopify_checkout_entry_v1", idempotency_key: "queue-full-0001" });
    // #then it is refused without a 402
    expect({ status: res.status, challenged: res.headers.get("payment-required") !== null, code: (await res.json()).code }).toEqual({ status: 429, challenged: false, code: "RATE_LIMITED" });
    await db.query("UPDATE inspections SET status = 'COMPLETED' WHERE id = ANY($1)", [filler]);
  });

  it("rate-limits quote bursts from one client", async () => {
    const statuses = [];
    for (let i = 0; i < 31; i++) {
      statuses.push((await post("/v1/quotes", { product_url: "https://example.com/x", authorized_target_id: "fixture-healthy-v1", profile: "shopify_checkout_entry_v1" })).status);
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it("reads require the inspection's own token", async () => {
    const { rows } = await db.query("SELECT id FROM inspections LIMIT 1");
    const id = rows[0].id as string;
    expect((await fetch(`${base}/v1/inspections/${id}`)).status).toBe(401);
    expect((await fetch(`${base}/v1/inspections/${id}`, { headers: { authorization: "Bearer rt_wrong" } })).status).toBe(401);
    expect((await fetch(`${base}/v1/reports/${id}/assets/${randomUUID()}?exp=9999999999&sig=forged`)).status).toBe(403);
  });
});
