import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { paymentMiddleware, type x402ResourceServer } from "@x402/express";
import {
  InspectionRequest,
  PROFILE,
  QuoteRequest,
  SCHEMA_VERSION,
  TERMINAL_STATUSES,
  VIEWPORTS,
  type ErrorCode,
  type InspectionStatus,
} from "../../../packages/contracts/src/index.js";
import type { Config } from "../../../packages/shared/src/config.js";
import { appendEvent, withTx, type Db } from "../../../packages/shared/src/db.js";
import type { EvidenceStore } from "../../../packages/shared/src/evidence.js";
import { log } from "../../../packages/shared/src/log.js";
import { checkProductUrl, resolvesToPublicAddress, type AllowedTarget } from "../../../packages/shared/src/targets.js";
import {
  deriveReadToken,
  hashToken,
  sha256Hex,
  signAssetUrl,
  tokenMatches,
  verifyAssetSignature,
} from "../../../packages/shared/src/tokens.js";
import { identityFromHeader, identityFromPayload } from "./payment-identity.js";
import { paidAccepts } from "./payments.js";
import { renderDocsPage, renderRunPage } from "./pages.js";
import { rateLimit } from "./rate-limit.js";
import { loadDemoRuns, parseDemoRuns, renderDemoPage, renderHomePage } from "./public-pages.js";

const QUOTE_TTL_MS = 15 * 60 * 1000;
const ASSET_URL_TTL_SEC = 30 * 60;
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MAX_BACKLOG = 10;

export interface AppDeps {
  config: Config;
  db: Db;
  evidence: EvidenceStore;
  resourceServer: x402ResourceServer;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

export function priceToAtomic(priceUsd: string): bigint {
  const [whole = "0", fraction = ""] = priceUsd.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0").slice(0, 6));
}

export function quoteRequestHash(normalizedUrl: string, targetId: string, profile: string, viewports: readonly string[]): string {
  return sha256Hex(JSON.stringify([normalizedUrl, targetId, profile, [...viewports].sort()]));
}

function intentHash(body: InspectionRequest, normalizedUrl: string): string {
  return sha256Hex(JSON.stringify([body.quote_id, normalizedUrl, body.authorized_target_id, body.profile, body.client_reference ?? null]));
}

function envelope(req: Request, payload: Record<string, unknown>) {
  return { ok: true, schema_version: SCHEMA_VERSION, request_id: req.requestId, ...payload };
}

function bearer(req: Request): string | undefined {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return typeof req.query.token === "string" ? req.query.token : undefined;
}

declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
  }
}

export function createApp(deps: AppDeps): express.Express {
  const { config, db, evidence, resourceServer } = deps;
  const app = express();
  app.set("trust proxy", true);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use((req, res, next) => {
    req.requestId = `req_${randomUUID()}`;
    res.setHeader("x-request-id", req.requestId);
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Robots-Tag", "noindex");
    const started = Date.now();
    res.on("finish", () => {
      log.info({ request_id: req.requestId, method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started, paid: Boolean(req.header("payment-signature")) }, "http");
    });
    next();
  });

  async function loadTarget(id: string): Promise<AllowedTarget | undefined> {
    const { rows } = await db.query(
      "SELECT id, origin, product_path_prefix, label, fixture_version FROM authorized_targets WHERE id = $1 AND is_active",
      [id],
    );
    const row = rows[0];
    return row ? { id: row.id, origin: row.origin, productPathPrefix: row.product_path_prefix, label: row.label, fixtureVersion: row.fixture_version } : undefined;
  }

  async function authorizeTarget(productUrl: string, targetId: string) {
    const check = checkProductUrl(productUrl, await loadTarget(targetId));
    if (!check.ok) throw new ApiError(403, "TARGET_NOT_AUTHORIZED", `Target not authorized: ${check.reason}.`);
    if (!(await resolvesToPublicAddress(new URL(check.normalizedUrl).hostname).catch(() => false))) {
      throw new ApiError(403, "TARGET_NOT_AUTHORIZED", "Target host does not resolve to a public address.");
    }
    return check;
  }

  app.get("/healthz", (req, res) => {
    res.json(envelope(req, { status: "ok", build: config.BUILD_VERSION }));
  });

  app.get("/readyz", async (req, res) => {
    const checks: Record<string, boolean> = {};
    checks.database = await db.query("SELECT 1").then(() => true, () => false);
    const { rows } = await db
      .query("SELECT max(seen_at) AS last FROM worker_heartbeats")
      .catch(() => ({ rows: [{ last: null }] }));
    checks.worker = config.WORKER_ENABLED === "false" || Boolean(rows[0]?.last && Date.now() - new Date(rows[0].last).getTime() < 120_000);
    const ready = Object.values(checks).every(Boolean);
    res.status(ready ? 200 : 503).json(envelope(req, { ready, checks }));
  });

  app.get("/v1/meta", async (req, res) => {
    const { rows } = await db.query("SELECT id, label, fixture_version FROM authorized_targets WHERE is_active ORDER BY id");
    res.json(
      envelope(req, {
        service: "AisleRun",
        build: config.BUILD_VERSION,
        description:
          "Paid synthetic shopper journey on an authorized storefront: product → cart → checkout entrance in mobile (390×844) and desktop (1440×900) Chromium. Never places orders.",
        profiles: [{ id: PROFILE, scope: ["product", "cart", "checkout_entry"], viewports: VIEWPORTS }],
        authorized_targets: rows.map((r) => ({ id: r.id, label: r.label, fixture_version: r.fixture_version })),
        payment: {
          protocol: "x402",
          x402_version: 2,
          scheme: "exact",
          network: config.X402_NETWORK,
          asset: USDC_BASE,
          asset_symbol: "USDC",
          price_usd: config.INSPECTION_PRICE_USD,
          facilitator: config.X402_FACILITATOR_URL,
        },
        docs_url: `${config.SERVICE_BASE_URL}/docs`,
        limitations: [
          "Only operator-authorized targets listed above can be inspected.",
          "No purchases, logins, payment details or bot-check bypass.",
          "A pass means this synthetic journey reached checkout entry once; it does not prove every buyer can check out.",
        ],
      }),
    );
  });

  app.use("/v1/quotes", rateLimit("quotes", 30, 60_000));
  app.use("/v1/inspections", rateLimit("inspections", 120, 60_000));
  app.use("/v1/reports", rateLimit("reports", 240, 60_000));

  app.post("/v1/quotes", async (req, res) => {
    const body = QuoteRequest.safeParse(req.body);
    if (!body.success) throw new ApiError(400, "INVALID_INPUT", body.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const check = await authorizeTarget(body.data.product_url, body.data.authorized_target_id);
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);
    const atomic = priceToAtomic(config.INSPECTION_PRICE_USD);
    await db.query(
      `INSERT INTO quotes (id, target_id, normalized_product_url, profile, viewports_json, price_amount_atomic, asset, network, expires_at, request_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, check.target.id, check.normalizedUrl, PROFILE, JSON.stringify(body.data.viewports), atomic.toString(), USDC_BASE, config.X402_NETWORK, expiresAt, quoteRequestHash(check.normalizedUrl, check.target.id, PROFILE, body.data.viewports)],
    );
    res.status(201).json(
      envelope(req, {
        quote_id: id,
        expires_at: expiresAt.toISOString(),
        target: { id: check.target.id, label: check.target.label, product_url: check.normalizedUrl, fixture_version: check.target.fixtureVersion },
        profile: PROFILE,
        viewports: body.data.viewports,
        scope: ["product", "cart", "checkout_entry"],
        price: { amount: config.INSPECTION_PRICE_USD, amount_atomic: atomic.toString(), asset: USDC_BASE, asset_symbol: "USDC", network: config.X402_NETWORK },
        target_is_authorized: true,
        estimated_duration_text: "About 30–60 seconds for both viewports on the fixture store (measured locally; not a guarantee).",
        limitations: "Synthetic journey to checkout entrance only. Never submits an order or payment details.",
        pay_with: { method: "POST", url: `${config.SERVICE_BASE_URL}/v1/inspections`, body_template: { quote_id: id, product_url: check.normalizedUrl, authorized_target_id: check.target.id, profile: PROFILE, idempotency_key: "<your stable uuid>" } },
      }),
    );
  });

  // Runs before the x402 middleware so that invalid, expired or replayed requests are refused
  // without ever issuing a payment challenge.
  async function preflightInspection(req: Request, res: Response, next: NextFunction) {
    const body = InspectionRequest.safeParse(req.body);
    if (!body.success) throw new ApiError(400, "INVALID_INPUT", body.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const check = await authorizeTarget(body.data.product_url, body.data.authorized_target_id);
    const { rows } = await db.query("SELECT * FROM quotes WHERE id = $1", [body.data.quote_id]);
    const quote = rows[0];
    if (!quote) throw new ApiError(404, "QUOTE_SCOPE_MISMATCH", "Unknown quote_id. Request a quote first.");
    if (quote.normalized_product_url !== check.normalizedUrl || quote.target_id !== check.target.id || quote.profile !== body.data.profile) {
      throw new ApiError(409, "QUOTE_SCOPE_MISMATCH", "Request does not match the quoted target, URL or profile.");
    }
    const existing = await db.query("SELECT id, idempotency_key, intent_hash FROM inspections WHERE quote_id = $1", [quote.id]);
    const prior = existing.rows[0];
    if (prior) {
      if (prior.idempotency_key === body.data.idempotency_key && prior.intent_hash === intentHash(body.data, check.normalizedUrl)) {
        res.status(200).json(await acceptedEnvelope(req, prior.id, true));
        return;
      }
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "This quote was already used by a different request.");
    }
    if (new Date(quote.expires_at).getTime() < Date.now()) throw new ApiError(410, "QUOTE_EXPIRED", "Quote expired. Request a new one.");
    const backlog = await db.query("SELECT count(*)::int AS n FROM inspections WHERE status IN ('AWAITING_SETTLEMENT','QUEUED')");
    if (backlog.rows[0].n >= MAX_BACKLOG) throw new ApiError(429, "RATE_LIMITED", "The inspection queue is full. No payment was requested; retry shortly.", true);
    res.locals.preflight = { body: body.data, normalizedUrl: check.normalizedUrl, quote };
    next();
  }

  async function acceptedEnvelope(req: Request, inspectionId: string, replay: boolean) {
    const { rows } = await db.query(
      "SELECT i.status, p.state, p.settlement_reference FROM inspections i JOIN payments p ON p.id = i.payment_id WHERE i.id = $1",
      [inspectionId],
    );
    const token = deriveReadToken(config.REPORT_TOKEN_SECRET, inspectionId);
    return envelope(req, {
      inspection_id: inspectionId,
      status: rows[0]?.status,
      replayed: replay,
      result_url: `${config.SERVICE_BASE_URL}/v1/inspections/${inspectionId}`,
      events_url: `${config.SERVICE_BASE_URL}/v1/inspections/${inspectionId}/events`,
      report_api_url: `${config.SERVICE_BASE_URL}/v1/reports/${inspectionId}`,
      report_url: `${config.WEB_BASE_URL}/runs/${inspectionId}#token=${token}`,
      read_token: token,
      read_instructions: "Send `Authorization: Bearer <read_token>` (or ?token=) to result_url; poll every 2 s until status is terminal.",
      poll_after_ms: 2000,
      payment: { state: rows[0]?.state ?? "VERIFIED", reference: rows[0]?.settlement_reference ?? null },
    });
  }

  const accepts = paidAccepts({ network: config.X402_NETWORK, facilitatorUrl: config.X402_FACILITATOR_URL, receiver: config.PAYMENT_RECEIVER, priceUsd: config.INSPECTION_PRICE_USD });

  resourceServer.onAfterSettle(async ({ paymentPayload, result }) => {
    const identity = identityFromPayload(paymentPayload as Parameters<typeof identityFromPayload>[0]);
    await withTx(db, async (tx) => {
      const payment = await tx.query(
        "UPDATE payments SET state = 'SETTLED', settlement_reference = $2, settled_at = now() WHERE fingerprint = $1 AND state = 'VERIFIED' RETURNING id",
        [identity.fingerprint, result.transaction],
      );
      const paymentId = payment.rows[0]?.id;
      if (!paymentId) return;
      const job = await tx.query(
        "UPDATE inspections SET status = 'QUEUED', queued_at = now() WHERE payment_id = $1 AND status = 'AWAITING_SETTLEMENT' RETURNING id",
        [paymentId],
      );
      for (const row of job.rows) {
        await appendEvent(tx, row.id, "payment_settled", { network: result.network, transaction: result.transaction, payer: identity.payer });
        await appendEvent(tx, row.id, "queued", { observed: "Payment settled; waiting for browser worker" });
      }
    });
  });

  resourceServer.onSettleFailure(async ({ paymentPayload, error }) => {
    const identity = identityFromPayload(paymentPayload as Parameters<typeof identityFromPayload>[0]);
    await withTx(db, async (tx) => {
      const payment = await tx.query("UPDATE payments SET state = 'DENIED' WHERE fingerprint = $1 AND state = 'VERIFIED' RETURNING id", [identity.fingerprint]);
      const paymentId = payment.rows[0]?.id;
      if (!paymentId) return;
      const job = await tx.query(
        "UPDATE inspections SET status = 'PAYMENT_DENIED', error_code = 'PAYMENT_DENIED', completed_at = now() WHERE payment_id = $1 AND status = 'AWAITING_SETTLEMENT' RETURNING id",
        [paymentId],
      );
      for (const row of job.rows) await appendEvent(tx, row.id, "payment_denied", { reason: error.message.slice(0, 300) });
    });
  });

  app.post("/v1/inspections", wrap(preflightInspection));
  app.use(
    paymentMiddleware(
      {
        "POST /v1/inspections": {
          accepts,
          description:
            "AisleRun: one paid synthetic shopper inspection (product → cart → checkout entry, mobile + desktop Chromium) of an authorized store. Get a free quote at POST /v1/quotes first.",
          mimeType: "application/json",
        },
      },
      resourceServer,
    ),
  );

  app.post(
    "/v1/inspections",
    wrap(async (req, res) => {
      const pre = res.locals.preflight as { body: InspectionRequest; normalizedUrl: string; quote: Record<string, unknown> } | undefined;
      const header = req.header("payment-signature");
      if (!pre || !header) throw new ApiError(402, "PAYMENT_UNVERIFIED", "Payment was not verified.");
      const identity = identityFromHeader(header);
      if (BigInt(identity.amountAtomic) !== BigInt(String(pre.quote.price_amount_atomic))) {
        throw new ApiError(402, "PAYMENT_UNVERIFIED", "Payment amount does not match the quote.");
      }
      const inspectionId = randomUUID();
      try {
        await withTx(db, async (tx) => {
          const paymentId = randomUUID();
          await tx.query(
            `INSERT INTO payments (id, quote_id, provider, network, payer, state, amount_atomic, fingerprint, safe_metadata_json)
             VALUES ($1, $2, 'x402', $3, $4, 'VERIFIED', $5, $6, $7)`,
            [paymentId, pre.quote.id, identity.network, identity.payer, identity.amountAtomic, identity.fingerprint, JSON.stringify({ facilitator: config.X402_FACILITATOR_URL, user_agent: req.header("user-agent") ?? null })],
          );
          await tx.query(
            `INSERT INTO inspections (id, quote_id, payment_id, idempotency_key, intent_hash, payer, target_id, product_url, profile, client_reference, status, report_access_key_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'AWAITING_SETTLEMENT', $11)`,
            [inspectionId, pre.quote.id, paymentId, pre.body.idempotency_key, intentHash(pre.body, pre.normalizedUrl), identity.payer, pre.body.authorized_target_id, pre.normalizedUrl, pre.body.profile, pre.body.client_reference ?? null, hashToken(deriveReadToken(config.REPORT_TOKEN_SECRET, inspectionId))],
          );
          await appendEvent(tx, inspectionId, "payment_verified", { payer: identity.payer, amount_atomic: identity.amountAtomic, network: identity.network });
        });
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "A concurrent request already used this quote or idempotency key; this payment was not settled.");
        }
        throw error;
      }
      res.status(200).json(await acceptedEnvelope(req, inspectionId, false));
    }),
  );

  async function authorizedInspection(req: Request) {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new ApiError(404, "JOB_NOT_FOUND", "No such inspection.");
    const { rows } = await db.query("SELECT * FROM inspections WHERE id = $1", [id]);
    const row = rows[0];
    if (!row) throw new ApiError(404, "JOB_NOT_FOUND", "No such inspection.");
    if (!tokenMatches(bearer(req), row.report_access_key_hash)) throw new ApiError(401, "REPORT_ACCESS_DENIED", "A valid read token is required.");
    return row;
  }

  app.get(
    "/v1/inspections/:id",
    wrap(async (req, res) => {
      const row = await authorizedInspection(req);
      const viewports = await db.query("SELECT viewport, status, verdict, blocker, attempts, start_at, end_at FROM viewport_runs WHERE inspection_id = $1 ORDER BY start_at", [row.id]);
      const last = await db.query("SELECT type, details_json, created_at FROM events WHERE inspection_id = $1 ORDER BY monotonic_sequence DESC LIMIT 1", [row.id]);
      const terminal = TERMINAL_STATUSES.includes(row.status as InspectionStatus);
      res.json(
        envelope(req, {
          inspection_id: row.id,
          status: row.status,
          terminal,
          overall_verdict: row.overall_verdict,
          error_code: row.error_code,
          product_url: row.product_url,
          viewports: viewports.rows,
          last_event: last.rows[0] ?? null,
          created_at: row.created_at,
          started_at: row.started_at,
          completed_at: row.completed_at,
          elapsed_ms: row.started_at ? (row.completed_at ? new Date(row.completed_at) : new Date()).getTime() - new Date(row.started_at).getTime() : null,
          report_api_url: terminal ? `${config.SERVICE_BASE_URL}/v1/reports/${row.id}` : null,
          poll_after_ms: terminal ? null : 2000,
        }),
      );
    }),
  );

  app.get(
    "/v1/inspections/:id/events",
    wrap(async (req, res) => {
      const row = await authorizedInspection(req);
      const after = Number.parseInt(String(req.query.after ?? "0"), 10) || 0;
      const { rows } = await db.query(
        "SELECT monotonic_sequence AS seq, type, details_json AS details, created_at FROM events WHERE inspection_id = $1 AND monotonic_sequence > $2 ORDER BY monotonic_sequence LIMIT 200",
        [row.id, after],
      );
      res.json(envelope(req, { inspection_id: row.id, status: row.status, events: rows, next_cursor: rows.at(-1)?.seq ?? after }));
    }),
  );

  app.get(
    "/v1/reports/:id",
    wrap(async (req, res) => {
      const row = await authorizedInspection(req);
      res.json(envelope(req, await buildReport(row)));
    }),
  );

  async function buildReport(row: Record<string, any>) {
    const [target, payment, runs, steps, artifacts] = await Promise.all([
      db.query("SELECT id, origin, label, fixture_version FROM authorized_targets WHERE id = $1", [row.target_id]),
      db.query("SELECT state, network, settlement_reference, settled_at, amount_atomic FROM payments WHERE id = $1", [row.payment_id]),
      db.query("SELECT * FROM viewport_runs WHERE inspection_id = $1 ORDER BY start_at", [row.id]),
      db.query("SELECT s.* FROM steps s JOIN viewport_runs v ON v.id = s.viewport_run_id WHERE v.inspection_id = $1 ORDER BY s.started_at, s.ordinal", [row.id]),
      db.query("SELECT id, viewport_run_id, kind, label, mime_type, bytes, sha256, created_at FROM artifacts WHERE inspection_id = $1 ORDER BY created_at, label", [row.id]),
    ]);
    const exp = Math.floor(Date.now() / 1000) + ASSET_URL_TTL_SEC;
    const terminal = TERMINAL_STATUSES.includes(row.status as InspectionStatus);
    const ready = terminal && (row.status === "COMPLETED" || row.status === "INCONCLUSIVE") && artifacts.rows.length > 0;
    const pay = payment.rows[0];
    return {
      inspection_id: row.id,
      run_label: `AR-${String(row.id).slice(0, 8).toUpperCase()}`,
      report_status: ready ? "READY" : terminal ? "UNAVAILABLE" : "PENDING",
      status: row.status,
      overall_verdict: row.overall_verdict,
      error_code: row.error_code,
      target: { ...target.rows[0], product_url: row.product_url },
      fixture_disclosure: target.rows[0]?.fixture_version
        ? `Synthetic AisleRun test fixture ${target.rows[0].fixture_version}. Any defect on it is seeded on purpose; no real merchant is affected.`
        : null,
      profile: row.profile,
      created_at: row.created_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      viewports: runs.rows.map((run) => ({
        viewport: run.viewport,
        size: VIEWPORTS[run.viewport as keyof typeof VIEWPORTS],
        verdict: run.verdict,
        blocker: run.blocker,
        attempts: run.attempts,
        browser_version: run.browser_version,
        fixture_version: run.fixture_version,
        started_at: run.start_at,
        ended_at: run.end_at,
        console_errors: run.console_errors_json,
        blocked_requests: run.blocked_requests_json,
        steps: steps.rows
          .filter((s) => s.viewport_run_id === run.id)
          .map((s) => ({ ordinal: s.ordinal, action: s.action, expected: s.expected_json, observed: s.observed_json, result: s.result, started_at: s.started_at, ended_at: s.ended_at, decision: s.decision_sentence, is_first_blocker: s.id === run.first_blocker_step_id })),
        artifacts: artifacts.rows
          .filter((a) => a.viewport_run_id === run.id)
          .map((a) => ({ id: a.id, kind: a.kind, label: a.label, mime_type: a.mime_type, bytes: Number(a.bytes), sha256: a.sha256, url: `${config.SERVICE_BASE_URL}/v1/reports/${row.id}/assets/${a.id}?exp=${exp}&sig=${signAssetUrl(config.REPORT_TOKEN_SECRET, row.id, a.id, exp)}`, url_expires_at: new Date(exp * 1000).toISOString() })),
      })),
      classification_source: "Deterministic scripted journey and rule-based classifier (packages/inspection). No language model produced this verdict.",
      limitations: [
        "Synthetic journey to the checkout entrance only. No order, payment details or account login were used.",
        "A PASS shows this journey succeeded in this run; it does not prove every buyer can check out.",
        "Chromium only. Root causes are not claimed; console errors are shown as raw evidence.",
      ],
      payment: pay ? { state: pay.state, network: pay.network, amount_atomic: String(pay.amount_atomic), settlement_reference: pay.settlement_reference, settled_at: pay.settled_at } : null,
      provenance: { build: config.BUILD_VERSION, profile: row.profile },
    };
  }

  app.get(
    "/v1/reports/:id/assets/:assetId",
    wrap(async (req, res) => {
      const id = String(req.params.id);
      const assetId = String(req.params.assetId);
      const exp = Number(req.query.exp);
      const sig = String(req.query.sig ?? "");
      if (!verifyAssetSignature(config.REPORT_TOKEN_SECRET, id, assetId, exp, sig, Math.floor(Date.now() / 1000))) {
        throw new ApiError(403, "REPORT_ACCESS_DENIED", "Asset link is invalid or expired.");
      }
      const { rows } = await db.query("SELECT object_key, mime_type, bytes FROM artifacts WHERE id = $1 AND inspection_id = $2", [assetId, id]);
      const asset = rows[0];
      if (!asset) throw new ApiError(404, "JOB_NOT_FOUND", "No such asset for this inspection.");
      res.setHeader("Content-Type", asset.mime_type);
      res.setHeader("Content-Length", String(asset.bytes));
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      evidence.open(asset.object_key).on("error", () => res.destroy()).pipe(res);
    }),
  );

  app.get("/runs/:id", (_req, res) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'");
    res.type("html").send(renderRunPage());
  });
  const demoRefs = parseDemoRuns(config.DEMO_RUNS);
  const PUBLIC_CSP = "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; media-src 'self'; img-src 'self'";
  app.get("/", async (_req, res) => {
    res.setHeader("Content-Security-Policy", PUBLIC_CSP);
    res.type("html").send(renderHomePage(config, await loadDemoRuns(db, config, demoRefs)));
  });
  app.get("/demo", async (_req, res) => {
    res.setHeader("Content-Security-Policy", PUBLIC_CSP);
    res.type("html").send(renderDemoPage(config, await loadDemoRuns(db, config, demoRefs)));
  });
  app.get("/docs", (_req, res) => {
    res.type("html").send(renderDocsPage(config));
  });

  app.use((req, res) => {
    res.status(404).json({ ok: false, code: "JOB_NOT_FOUND", message: "Not found.", retryable: false, request_id: req.requestId });
  });
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError) {
      res.status(error.status).json({ ok: false, code: error.code, message: error.message, retryable: error.retryable, request_id: req.requestId });
      return;
    }
    if ((error as { type?: string }).type === "entity.parse.failed") {
      res.status(400).json({ ok: false, code: "INVALID_INPUT", message: "Body must be valid JSON.", retryable: false, request_id: req.requestId });
      return;
    }
    log.error({ request_id: req.requestId, err: error instanceof Error ? error.message : String(error) }, "unhandled");
    res.status(500).json({ ok: false, code: "INTERNAL_FAILURE", message: "Internal failure.", retryable: true, request_id: req.requestId });
  });

  return app;
}

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
