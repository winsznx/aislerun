import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import type { Verdict, ViewportName } from "../../../packages/contracts/src/index.js";
import { runViewportJourney, type JourneyEvent, type ViewportOutcome } from "../../../packages/inspection/src/journey.js";
import { appendEvent, withTx, type Db } from "../../../packages/shared/src/db.js";
import type { EvidenceStore, StoredObject } from "../../../packages/shared/src/evidence.js";
import { log } from "../../../packages/shared/src/log.js";
import type { AllowedTarget } from "../../../packages/shared/src/targets.js";

const LEASE_MS = 3 * 60 * 1000;
const JOB_DEADLINE_MS = 150 * 1000;
const MAX_ATTEMPTS = 2;
const VIEWPORT_ORDER: ViewportName[] = ["mobile", "desktop"];

export interface WorkerDeps {
  db: Db;
  evidence: EvidenceStore;
  workerId?: string;
  launch?: () => Promise<Browser>;
}

interface ClaimedJob {
  id: string;
  productUrl: string;
  attempt: number;
  recovered: boolean;
  target: AllowedTarget;
  viewports: ViewportName[];
}

export function overallVerdict(verdicts: Verdict[]): Verdict {
  if (verdicts.includes("FAIL")) return "FAIL";
  if (verdicts.length === 0 || verdicts.includes("INCONCLUSIVE")) return "INCONCLUSIVE";
  return "PASS";
}

// Claims one runnable job. A job whose lease expired mid-run is re-run once on the same payment
// (recovery), never re-charged; after MAX_ATTEMPTS it is closed as FAILED_INTERNAL.
export async function claimJob(db: Db, workerId: string): Promise<ClaimedJob | null> {
  return withTx(db, async (tx) => {
    const expired = await tx.query(
      `SELECT id FROM inspections
       WHERE status IN ('STARTING','RUNNING_MOBILE','RUNNING_DESKTOP','UPLOADING_EVIDENCE')
         AND lease_expires_at < now() AND attempt_count >= $1
       FOR UPDATE SKIP LOCKED`,
      [MAX_ATTEMPTS],
    );
    for (const row of expired.rows) {
      await tx.query("UPDATE inspections SET status = 'FAILED_INTERNAL', error_code = 'INTERNAL_FAILURE', completed_at = now(), lease_owner = NULL WHERE id = $1", [row.id]);
      await appendEvent(tx, row.id, "failed_internal", { observed: "Worker stopped responding twice; no store verdict was produced and no new charge was made." });
    }

    const { rows } = await tx.query(
      `SELECT i.id, i.product_url, i.attempt_count, i.status, q.viewports_json,
              t.id AS target_id, t.origin, t.product_path_prefix, t.label, t.fixture_version
       FROM inspections i
       JOIN quotes q ON q.id = i.quote_id
       JOIN authorized_targets t ON t.id = i.target_id
       WHERE i.status = 'QUEUED'
          OR (i.status IN ('STARTING','RUNNING_MOBILE','RUNNING_DESKTOP','UPLOADING_EVIDENCE') AND i.lease_expires_at < now() AND i.attempt_count < $1)
       ORDER BY i.queued_at
       LIMIT 1
       FOR UPDATE OF i SKIP LOCKED`,
      [MAX_ATTEMPTS],
    );
    const row = rows[0];
    if (!row) return null;
    const recovered = row.status !== "QUEUED";
    if (recovered) {
      await tx.query("DELETE FROM steps WHERE viewport_run_id IN (SELECT id FROM viewport_runs WHERE inspection_id = $1)", [row.id]);
      await tx.query("DELETE FROM artifacts WHERE inspection_id = $1", [row.id]);
      await tx.query("DELETE FROM viewport_runs WHERE inspection_id = $1", [row.id]);
    }
    await tx.query(
      `UPDATE inspections SET status = 'STARTING', lease_owner = $2, lease_expires_at = now() + $3::interval,
              attempt_count = attempt_count + 1, started_at = COALESCE(started_at, now()), deadline_at = now() + $4::interval
       WHERE id = $1`,
      [row.id, workerId, `${LEASE_MS} milliseconds`, `${JOB_DEADLINE_MS} milliseconds`],
    );
    await appendEvent(tx, row.id, recovered ? "recovery_rerun" : "starting", {
      observed: recovered ? "Previous worker stopped; re-running the same paid job once without a new charge." : "Browser worker picked up the job.",
      worker: workerId,
    });
    return {
      id: row.id,
      productUrl: row.product_url,
      attempt: row.attempt_count + 1,
      recovered,
      viewports: VIEWPORT_ORDER.filter((v) => (row.viewports_json as string[]).includes(v)),
      target: { id: row.target_id, origin: row.origin, productPathPrefix: row.product_path_prefix, label: row.label, fixtureVersion: row.fixture_version },
    };
  });
}

export async function runJob(deps: WorkerDeps, job: ClaimedJob, browser: Browser, workerId: string): Promise<void> {
  const { db, evidence } = deps;
  const workDir = await mkdtemp(join(tmpdir(), `aislerun-${job.id.slice(0, 8)}-`));
  const deadline = Date.now() + JOB_DEADLINE_MS;
  const renew = () => db.query("UPDATE inspections SET lease_expires_at = now() + $2::interval WHERE id = $1 AND lease_owner = $3", [job.id, `${LEASE_MS} milliseconds`, workerId]);

  try {
    const outcomes: ViewportOutcome[] = [];
    for (const viewport of job.viewports) {
      if (Date.now() > deadline) throw new DeadlineExceeded();
      await db.query("UPDATE inspections SET status = $2 WHERE id = $1", [job.id, viewport === "mobile" ? "RUNNING_MOBILE" : "RUNNING_DESKTOP"]);
      await appendEvent(db, job.id, "viewport_started", { viewport });
      await renew();
      const emit = async (event: JourneyEvent) => {
        await appendEvent(db, job.id, event.type, { viewport: event.viewport, step: event.step, observed: event.observed, next_action: event.nextAction, cause_effect: event.causeEffect });
      };
      const outcome = await withDeadline(
        runViewportJourney({ browser, viewport, productUrl: job.productUrl, target: job.target, workDir, emit }),
        deadline - Date.now(),
      );
      outcomes.push(outcome);
      await appendEvent(db, job.id, "viewport_finished", { viewport, verdict: outcome.verdict, blocker: outcome.blocker, attempts: outcome.attempts });
    }

    await db.query("UPDATE inspections SET status = 'UPLOADING_EVIDENCE' WHERE id = $1", [job.id]);
    await appendEvent(db, job.id, "uploading_evidence", { observed: "Storing screenshots, recordings and traces" });
    await renew();

    const stored: Array<{ viewport: ViewportName; artifact: ViewportOutcome["artifacts"][number]; object: StoredObject }> = [];
    for (const outcome of outcomes) {
      for (const artifact of outcome.artifacts) {
        stored.push({ viewport: outcome.viewport, artifact, object: await evidence.put(job.id, artifact.path) });
      }
    }

    const verdict = overallVerdict(outcomes.map((o) => o.verdict));
    await withTx(db, async (tx) => {
      const runIds = new Map<ViewportName, string>();
      for (const outcome of outcomes) {
        const runId = randomUUID();
        runIds.set(outcome.viewport, runId);
        await tx.query(
          `INSERT INTO viewport_runs (id, inspection_id, viewport, browser_version, fixture_version, status, verdict, blocker, attempts, console_errors_json, blocked_requests_json, start_at, end_at)
           VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $6, $7, $8, $9, $10, $11, $12)`,
          [runId, job.id, outcome.viewport, `Chromium ${browser.version()}`, outcome.fixtureVersion, outcome.verdict, outcome.blocker, outcome.attempts, JSON.stringify(outcome.consoleErrors), JSON.stringify(outcome.blockedRequests), outcome.startedAt, outcome.endedAt],
        );
        let firstBlockerId: string | null = null;
        for (const step of outcome.steps) {
          const stepId = randomUUID();
          if (step.ordinal === outcome.firstBlockerOrdinal) firstBlockerId = stepId;
          await tx.query(
            `INSERT INTO steps (id, viewport_run_id, ordinal, action, expected_json, observed_json, result, started_at, ended_at, decision_sentence)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [stepId, runId, step.ordinal, step.action, JSON.stringify(step.expected), JSON.stringify(step.observed), step.result, step.startedAt, step.endedAt, step.decision],
          );
        }
        if (firstBlockerId) await tx.query("UPDATE viewport_runs SET first_blocker_step_id = $2 WHERE id = $1", [runId, firstBlockerId]);
      }
      for (const { viewport, artifact, object } of stored) {
        await tx.query(
          `INSERT INTO artifacts (id, inspection_id, viewport_run_id, kind, label, object_key, mime_type, bytes, sha256)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [randomUUID(), job.id, runIds.get(viewport), artifact.kind, artifact.label, object.key, artifact.mimeType, object.bytes, object.sha256],
        );
      }
      const status = verdict === "INCONCLUSIVE" ? "INCONCLUSIVE" : "COMPLETED";
      await tx.query(
        "UPDATE inspections SET status = $2, overall_verdict = $3, completed_at = now(), lease_owner = NULL WHERE id = $1 AND lease_owner = $4",
        [job.id, status, verdict, workerId],
      );
      await appendEvent(tx, job.id, "completed", {
        overall_verdict: verdict,
        viewports: Object.fromEntries(outcomes.map((o) => [o.viewport, o.verdict])),
        artifacts: stored.length,
      });
    });
  } catch (error) {
    const timedOut = error instanceof DeadlineExceeded;
    log.error({ inspection_id: job.id, err: error instanceof Error ? error.message : String(error) }, "job failed");
    await db.query(
      "UPDATE inspections SET status = $2, error_code = $3, completed_at = now(), lease_owner = NULL WHERE id = $1 AND lease_owner = $4",
      [job.id, timedOut ? "CANCELLED" : "FAILED_INTERNAL", timedOut ? "WORKER_TIMEOUT" : "INTERNAL_FAILURE", workerId],
    );
    await appendEvent(db, job.id, timedOut ? "cancelled" : "failed_internal", {
      observed: timedOut
        ? `The job exceeded its ${JOB_DEADLINE_MS / 1000}s budget and was cancelled. No store verdict was produced.`
        : "AisleRun hit an internal error. This is a service failure, not a store defect.",
    });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

class DeadlineExceeded extends Error {}

async function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DeadlineExceeded()), Math.max(ms, 0));
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function startWorkerLoop(deps: WorkerDeps, signal: AbortSignal): Promise<void> {
  const workerId = deps.workerId ?? `worker-${randomUUID().slice(0, 8)}`;
  const launch = deps.launch ?? (() => chromium.launch({ args: ["--disable-dev-shm-usage"] }));
  let browser: Browser | null = null;
  let lastBeat = 0;
  log.info({ worker: workerId }, "worker started");
  while (!signal.aborted) {
    try {
      if (Date.now() - lastBeat > 30_000) {
        await deps.db.query(
          "INSERT INTO worker_heartbeats (worker_id, seen_at) VALUES ($1, now()) ON CONFLICT (worker_id) DO UPDATE SET seen_at = now()",
          [workerId],
        );
        lastBeat = Date.now();
      }
      const job = await claimJob(deps.db, workerId);
      if (!job) {
        await sleep(1000, signal);
        continue;
      }
      log.info({ inspection_id: job.id, attempt: job.attempt, recovered: job.recovered }, "job claimed");
      if (!browser || !browser.isConnected()) browser = await launch();
      await runJob(deps, job, browser, workerId);
      log.info({ inspection_id: job.id }, "job finished");
    } catch (error) {
      log.error({ err: error instanceof Error ? error.message : String(error) }, "worker loop error");
      await sleep(2000, signal);
    }
  }
  await browser?.close().catch(() => undefined);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
