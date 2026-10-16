export type Verdict = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface Step {
  ordinal: number;
  action: string;
  expected: string;
  observed: Record<string, unknown>;
  result: "PASS" | "FAIL" | "INCONCLUSIVE" | "SKIPPED";
  started_at: string;
  ended_at: string;
  duration_ms: number;
  video_offset_ms: number | null;
  decision: string;
  is_first_blocker: boolean;
}

export interface Artifact {
  id: string;
  kind: "screenshot" | "video" | "trace";
  label: string;
  attempt: number;
  mime_type: string;
  bytes: number;
  sha256: string;
  url: string;
}

export interface ViewportReport {
  viewport: "mobile" | "desktop";
  size: { width: number; height: number };
  verdict: Verdict;
  blocker: string | null;
  attempts: number;
  browser_version: string;
  fixture_version: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  console_errors: string[];
  blocked_requests: string[];
  retry: { at: string; observed?: string; cause_effect?: string } | null;
  recording: { url: string; mime_type: string; attempt: number; poster_url: string | null; offsets_are_approximate: boolean } | null;
  steps: Step[];
  artifacts: Artifact[];
}

export interface Report {
  inspection_id: string;
  run_label: string;
  report_status: "READY" | "UNAVAILABLE" | "PENDING";
  status: string;
  overall_verdict: Verdict | null;
  error_code: string | null;
  target: { id: string; origin: string; label: string; fixture_version: string | null; product_url: string };
  fixture_version: string | null;
  fixture_disclosure: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  asset_urls_expire_at: string;
  viewports: ViewportReport[];
  classification_source: string;
  limitations: string[];
  payment: { state: string; network: string; amount_atomic: string; settlement_reference: string | null; settled_at: string | null } | null;
  provenance: { build: string; profile: string };
}

export interface DemoRun {
  role: "failed" | "retest" | "control" | "blocked" | string;
  report: Report;
}

export interface Comparison {
  before: Report;
  after: Report;
  repair: { file: string; before: string; after: string; note: string } | null;
}

export interface InspectionStatus {
  inspection_id: string;
  status: string;
  terminal: boolean;
  overall_verdict: Verdict | null;
  error_code: string | null;
  product_url: string;
  elapsed_ms: number | null;
}

export interface RunEvent {
  seq: number;
  type: string;
  details: { viewport?: string; step?: string; observed?: string; next_action?: string; cause_effect?: string };
  created_at: string;
}
