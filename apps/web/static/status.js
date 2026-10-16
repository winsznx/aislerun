// One vocabulary for every screen. Each inspection status maps to exactly one view kind, so the UI
// never spins forever and never shows a service failure as a store verdict.
export const TERMINAL = ["PAYMENT_DENIED", "COMPLETED", "INCONCLUSIVE", "FAILED_INTERNAL", "CANCELLED"];

const STATUS = {
  AWAITING_SETTLEMENT: { kind: "live", title: "Waiting for settlement", now: "The payment was verified. AisleRun waits for it to settle on Base before starting a browser.", next: "Queue the job" },
  QUEUED: { kind: "live", title: "Queued", now: "Payment settled. The job is waiting for the browser worker.", next: "Launch Chromium" },
  STARTING: { kind: "live", title: "Starting", now: "The worker picked up the job and is launching Chromium.", next: "Mobile journey" },
  RUNNING_MOBILE: { kind: "live", title: "Running mobile", now: "Running the shopper journey at 390×844.", next: "Desktop journey" },
  RUNNING_DESKTOP: { kind: "live", title: "Running desktop", now: "Running the shopper journey at 1440×900.", next: "Store evidence" },
  UPLOADING_EVIDENCE: { kind: "live", title: "Storing evidence", now: "Saving recordings, screenshots and traces. No verdict is shown until they are stored.", next: "Report" },
  COMPLETED: { kind: "report", title: "Completed" },
  INCONCLUSIVE: { kind: "report", title: "Inconclusive" },
  PAYMENT_DENIED: { kind: "stopped", title: "Payment not settled", now: "The payment did not settle, so no browser work ran and nothing was tested." },
  FAILED_INTERNAL: { kind: "stopped", title: "Inspection service error", now: "AisleRun failed internally. This is a service failure, not a problem with the store." },
  CANCELLED: { kind: "stopped", title: "Cancelled by time limit", now: "The run exceeded its time budget and was stopped. No store verdict was produced." },
};

export function statusInfo(status) {
  return STATUS[status] ?? { kind: "stopped", title: "Unknown state", now: `AisleRun reported "${status}", which this page does not recognise.` };
}

export function isTerminal(status) {
  return TERMINAL.includes(status);
}

const BLOCKERS = {
  ADD_TO_CART_NO_EFFECT: "Add to cart had no effect",
  CHECKOUT_ENTRY_BLOCKED: "Checkout could not be reached",
  BROWSER_BLOCKED: "Blocked by a bot check",
  PRODUCT_UNAVAILABLE: "Product unavailable",
  UNSUPPORTED_MARKUP: "Store controls not recognised",
  NAVIGATION_FAILED: "Page did not load",
  TARGET_LEFT_ALLOWLIST: "Left the authorized store",
};

export function blockerText(blocker) {
  return blocker ? BLOCKERS[blocker] ?? blocker : null;
}

export function viewportSummary(viewport) {
  if (viewport.verdict === "PASS") return "Reached checkout entry";
  return blockerText(viewport.blocker) ?? viewport.verdict;
}

const ACTIONS = {
  load: "Product page loaded",
  ready: "Product and price found",
  variant: "Variant selected",
  add_to_cart: "Add to cart clicked",
  confirm_cart: "Cart checked",
  checkout_entry: "Checkout entry",
};

export function actionText(action) {
  return ACTIONS[action] ?? action.replace(/_/g, " ");
}

export function statusClass(result) {
  if (result === "PASS" || result === "FAIL" || result === "INCONCLUSIVE" || result === "SKIPPED") return `status-${result}`;
  return "status-SERVICE";
}

export function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms)) return "–";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatOffset(ms) {
  if (ms == null) return "–";
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

export function formatUtc(iso) {
  if (!iso) return "–";
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function usdc(atomic) {
  return `${(Number(atomic) / 1e6).toFixed(2)} USDC`;
}

export function summaryText(report) {
  const lines = [
    `AisleRun ${report.run_label} (${report.inspection_id})`,
    `Target: ${report.target.product_url}${report.fixture_version ? ` [controlled test fixture ${report.fixture_version}]` : ""}`,
    `Overall: ${report.overall_verdict ?? report.status}`,
    ...report.viewports.map((v) => `${v.viewport} ${v.size.width}×${v.size.height}: ${v.verdict}${v.blocker ? ` (${v.blocker})` : ""}, ${v.attempts} attempt(s)`),
  ];
  const blocker = report.viewports.flatMap((v) => v.steps.filter((s) => s.is_first_blocker).map((s) => ({ v, s })))[0];
  if (blocker) lines.push(`First blocker on ${blocker.v.viewport}: ${blocker.s.decision}`);
  if (report.payment?.settlement_reference) lines.push(`Paid via PayBox/x402: ${usdc(report.payment.amount_atomic)} on ${report.payment.network}, tx ${report.payment.settlement_reference}`);
  lines.push("Checkout entry only; no order was placed.");
  return lines.join("\n");
}
