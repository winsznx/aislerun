import type { Verdict, ViewportReport } from "./types.js";

// One vocabulary for every screen. Each backend status maps to exactly one view kind, so nothing
// spins forever and a service failure is never shown as a store verdict.
export const TERMINAL = ["PAYMENT_DENIED", "COMPLETED", "INCONCLUSIVE", "FAILED_INTERNAL", "CANCELLED"] as const;

export interface StatusInfo {
  kind: "live" | "report" | "stopped";
  title: string;
  now?: string;
  next?: string;
}

const STATUS: Record<string, StatusInfo> = {
  AWAITING_SETTLEMENT: { kind: "live", title: "Waiting for settlement", now: "The payment was verified. The browser starts once it settles on Base.", next: "Queue the job" },
  QUEUED: { kind: "live", title: "Queued", now: "Payment settled. Waiting for the browser worker.", next: "Launch Chromium" },
  STARTING: { kind: "live", title: "Starting", now: "The worker picked up the job and is launching Chromium.", next: "Mobile journey" },
  RUNNING_MOBILE: { kind: "live", title: "Running mobile", now: "Running the shopper journey at 390 × 844.", next: "Desktop journey" },
  RUNNING_DESKTOP: { kind: "live", title: "Running desktop", now: "Running the shopper journey at 1440 × 900.", next: "Store evidence" },
  UPLOADING_EVIDENCE: { kind: "live", title: "Storing evidence", now: "Saving recordings, screenshots and traces. No verdict is shown before they are stored.", next: "Report" },
  COMPLETED: { kind: "report", title: "Completed" },
  INCONCLUSIVE: { kind: "report", title: "Inconclusive" },
  PAYMENT_DENIED: { kind: "stopped", title: "Payment not settled", now: "The payment did not settle, so no browser work ran and nothing was tested." },
  FAILED_INTERNAL: { kind: "stopped", title: "Inspection service error", now: "AisleRun failed internally. This is a service failure, not a problem with the store." },
  CANCELLED: { kind: "stopped", title: "Stopped by time limit", now: "The run went past its time budget and was stopped. No store verdict was produced." },
};

export function statusInfo(status: string): StatusInfo {
  return STATUS[status] ?? { kind: "stopped", title: "Unknown state", now: `AisleRun reported "${status}", which this page does not recognise.` };
}

export const isTerminal = (status: string) => (TERMINAL as readonly string[]).includes(status);

const BLOCKERS: Record<string, string> = {
  ADD_TO_CART_NO_EFFECT: "Add to cart had no effect",
  CHECKOUT_ENTRY_BLOCKED: "Checkout couldn't be reached",
  BROWSER_BLOCKED: "Stopped by a bot check",
  PRODUCT_UNAVAILABLE: "Product unavailable",
  UNSUPPORTED_MARKUP: "Store controls not recognised",
  NAVIGATION_FAILED: "Page didn't load",
  TARGET_LEFT_ALLOWLIST: "Left the authorized store",
};

export const blockerText = (blocker: string | null) => (blocker ? BLOCKERS[blocker] ?? blocker : null);

export function viewportSummary(v: Pick<ViewportReport, "verdict" | "blocker">): string {
  if (v.verdict === "PASS") return "Reached checkout entry";
  return blockerText(v.blocker) ?? v.verdict;
}

const ACTIONS: Record<string, string> = {
  load: "Product page loaded",
  ready: "Product and price found",
  variant: "Variant selected",
  add_to_cart: "Add to cart pressed",
  confirm_cart: "Cart checked",
  checkout_entry: "Checkout opened",
};

export const actionText = (action: string) => ACTIONS[action] ?? action.replace(/_/g, " ");

export function tagTone(result: string | null | undefined): "pass" | "fail" | "unsure" | "neutral" {
  if (result === "PASS") return "pass";
  if (result === "FAIL") return "fail";
  if (result === "INCONCLUSIVE") return "unsure";
  return "neutral";
}

export const verdictWord = (v: Verdict | null | undefined) => (v === "PASS" ? "Pass" : v === "FAIL" ? "Fail" : v === "INCONCLUSIVE" ? "Inconclusive" : "No verdict");
