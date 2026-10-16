import { FIXTURES } from "../../fixtures/src/fixtures.js";
import { TERMINAL_STATUSES, VIEWPORTS, type InspectionStatus } from "../../../packages/contracts/src/index.js";
import type { Config } from "../../../packages/shared/src/config.js";
import type { Db } from "../../../packages/shared/src/db.js";
import { signAssetUrl } from "../../../packages/shared/src/tokens.js";

const ASSET_URL_TTL_SEC = 30 * 60;

export interface InspectionRow {
  id: string;
  target_id: string;
  payment_id: string;
  product_url: string;
  profile: string;
  status: string;
  overall_verdict: string | null;
  error_code: string | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

interface ArtifactRow {
  id: string;
  viewport_run_id: string;
  kind: string;
  label: string;
  mime_type: string;
  bytes: string;
  sha256: string;
}

const SHOT_ORDER = ["page-loaded", "product-loaded", "before-add-to-cart", "after-add-to-cart", "checkout-entry"];

export function artifactOrder(label: string): number {
  const stage = SHOT_ORDER.findIndex((name) => label.endsWith(name));
  return attemptOf(label) * 100 + (stage === -1 ? 50 : stage);
}

// Artifact labels are written by the worker as "<viewport> #<attempt> <name>".
export function attemptOf(label: string): number {
  const match = /#(\d+)\b/.exec(label);
  return match ? Number(match[1]) : 1;
}

// The recording of an attempt starts when its browser context is created, which happens right
// after the attempt_started event is written. Offsets are therefore approximate (tens of ms late),
// and the UI labels them as such.
export function stepOffsetMs(stepStartedAt: Date | string, attemptStartedAt: Date | string | null): number | null {
  if (!attemptStartedAt) return null;
  const offset = new Date(stepStartedAt).getTime() - new Date(attemptStartedAt).getTime();
  return offset >= 0 ? offset : null;
}

export function fixtureRepair(beforeVersion: string | null, afterVersion: string | null) {
  const before = FIXTURES.find((f) => f.version === beforeVersion);
  const after = FIXTURES.find((f) => f.version === afterVersion);
  if (!before || !after || before.drawerLookup === after.drawerLookup) return null;
  return {
    file: "apps/fixtures/src/site/cart.js (function cartDrawer)",
    before: before.drawerLookup.split("\n").map((l) => l.trim()).join("\n"),
    after: after.drawerLookup.split("\n").map((l) => l.trim()).join("\n"),
    note: `${after.version} differs from ${before.version} only in the cart drawer lookup. The broken version looked for an element that does not exist below 750px.`,
  };
}

export async function buildReport(db: Db, config: Config, row: InspectionRow) {
  const [target, payment, runs, steps, artifacts, attemptEvents, retryEvents] = await Promise.all([
    db.query("SELECT id, origin, label, fixture_version FROM authorized_targets WHERE id = $1", [row.target_id]),
    db.query("SELECT state, network, settlement_reference, settled_at, amount_atomic FROM payments WHERE id = $1", [row.payment_id]),
    db.query("SELECT * FROM viewport_runs WHERE inspection_id = $1 ORDER BY CASE viewport WHEN 'mobile' THEN 0 ELSE 1 END", [row.id]),
    db.query("SELECT s.* FROM steps s JOIN viewport_runs v ON v.id = s.viewport_run_id WHERE v.inspection_id = $1 ORDER BY s.started_at, s.ordinal", [row.id]),
    db.query<ArtifactRow>("SELECT id, viewport_run_id, kind, label, mime_type, bytes, sha256 FROM artifacts WHERE inspection_id = $1 ORDER BY label", [row.id]),
    db.query("SELECT details_json->>'viewport' AS viewport, created_at FROM events WHERE inspection_id = $1 AND type = 'attempt_started' ORDER BY monotonic_sequence", [row.id]),
    db.query("SELECT details_json AS details, created_at FROM events WHERE inspection_id = $1 AND type = 'retrying' ORDER BY monotonic_sequence", [row.id]),
  ]);
  const exp = Math.floor(Date.now() / 1000) + ASSET_URL_TTL_SEC;
  const assetUrl = (assetId: string) =>
    `${config.SERVICE_BASE_URL}/v1/reports/${row.id}/assets/${assetId}?exp=${exp}&sig=${signAssetUrl(config.REPORT_TOKEN_SECRET, row.id, assetId, exp)}`;
  const terminal = TERMINAL_STATUSES.includes(row.status as InspectionStatus);
  const ready = terminal && (row.status === "COMPLETED" || row.status === "INCONCLUSIVE") && artifacts.rows.length > 0;
  const pay = payment.rows[0];
  const fixtureVersion = target.rows[0]?.fixture_version ?? null;

  return {
    inspection_id: row.id,
    run_label: `AR-${row.id.slice(0, 8).toUpperCase()}`,
    report_status: ready ? "READY" : terminal ? "UNAVAILABLE" : "PENDING",
    status: row.status,
    overall_verdict: row.overall_verdict,
    error_code: row.error_code,
    target: { ...target.rows[0], product_url: row.product_url },
    fixture_version: fixtureVersion,
    fixture_disclosure: fixtureVersion
      ? `Controlled test fixture ${fixtureVersion}. Any defect on it is seeded on purpose; no real merchant is affected.`
      : null,
    profile: row.profile,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    duration_ms: row.started_at && row.completed_at ? new Date(row.completed_at).getTime() - new Date(row.started_at).getTime() : null,
    asset_urls_expire_at: new Date(exp * 1000).toISOString(),
    viewports: runs.rows.map((run) => {
      const own = artifacts.rows.filter((a) => a.viewport_run_id === run.id).sort((x, y) => artifactOrder(x.label) - artifactOrder(y.label));
      const finalAttempt = Number(run.attempts);
      const attemptStarts = attemptEvents.rows.filter((e) => e.viewport === run.viewport).map((e) => e.created_at as Date);
      const finalAttemptStart = attemptStarts[finalAttempt - 1] ?? null;
      const video = own.find((a) => a.kind === "video" && attemptOf(a.label) === finalAttempt);
      const shots = own.filter((a) => a.kind === "screenshot");
      const poster = shots.find((a) => attemptOf(a.label) === finalAttempt && /page-loaded|product-loaded/.test(a.label));
      const retry = retryEvents.rows.find((e) => e.details?.viewport === run.viewport);
      return {
        viewport: run.viewport,
        size: VIEWPORTS[run.viewport as keyof typeof VIEWPORTS],
        verdict: run.verdict,
        blocker: run.blocker,
        attempts: finalAttempt,
        browser_version: run.browser_version,
        fixture_version: run.fixture_version,
        started_at: run.start_at,
        ended_at: run.end_at,
        duration_ms: run.end_at ? new Date(run.end_at).getTime() - new Date(run.start_at).getTime() : null,
        console_errors: run.console_errors_json,
        blocked_requests: run.blocked_requests_json,
        retry: retry ? { at: retry.created_at, observed: retry.details.observed, cause_effect: retry.details.cause_effect } : null,
        recording: video
          ? { url: assetUrl(video.id), mime_type: video.mime_type, attempt: finalAttempt, poster_url: poster ? assetUrl(poster.id) : null, offsets_are_approximate: true }
          : null,
        steps: steps.rows
          .filter((s) => s.viewport_run_id === run.id)
          .map((s) => ({
            ordinal: s.ordinal,
            action: s.action,
            expected: s.expected_json,
            observed: s.observed_json,
            result: s.result,
            started_at: s.started_at,
            ended_at: s.ended_at,
            duration_ms: new Date(s.ended_at).getTime() - new Date(s.started_at).getTime(),
            video_offset_ms: stepOffsetMs(s.started_at, finalAttemptStart),
            decision: s.decision_sentence,
            is_first_blocker: s.id === run.first_blocker_step_id,
          })),
        artifacts: own.map((a) => ({
          id: a.id,
          kind: a.kind,
          label: a.label,
          attempt: attemptOf(a.label),
          mime_type: a.mime_type,
          bytes: Number(a.bytes),
          sha256: a.sha256,
          url: assetUrl(a.id),
        })),
      };
    }),
    classification_source: "Deterministic scripted journey and rule-based classifier (packages/inspection). No language model produced this verdict.",
    limitations: [
      "Synthetic journey to the checkout entrance only. No order, payment details or account login were used.",
      "A PASS shows this journey succeeded in this run; it does not prove every buyer can check out.",
      "Chromium only. Root causes are not claimed; console errors are shown as raw evidence.",
    ],
    payment: pay
      ? { state: pay.state, network: pay.network, amount_atomic: String(pay.amount_atomic), settlement_reference: pay.settlement_reference, settled_at: pay.settled_at }
      : null,
    provenance: { build: config.BUILD_VERSION, profile: row.profile },
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

export type ComparisonCheck = { ok: true } | { ok: false; reason: string };

// Two runs are comparable when they inspect the same product on the same origin (fixture versions
// may differ: that difference is the repair), are different paid jobs, and the "after" run is later.
export function checkComparable(before: Report, after: Report): ComparisonCheck {
  if (before.inspection_id === after.inspection_id) return { ok: false, reason: "A run cannot be compared with itself." };
  const a = new URL(before.target.product_url);
  const b = new URL(after.target.product_url);
  const product = (u: URL) => u.pathname.replace(/^\/v\/[^/]+/, "");
  if (a.origin !== b.origin || product(a) !== product(b)) return { ok: false, reason: "These runs inspected different products." };
  if (new Date(after.created_at).getTime() <= new Date(before.created_at).getTime()) return { ok: false, reason: "The retest must be newer than the original run." };
  if (before.report_status !== "READY" || after.report_status !== "READY") return { ok: false, reason: "Both runs must have finished with stored evidence." };
  return { ok: true };
}

export function comparisonBody(before: Report, after: Report) {
  return { before, after, repair: fixtureRepair(before.fixture_version, after.fixture_version) };
}
