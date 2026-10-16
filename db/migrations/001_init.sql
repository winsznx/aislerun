CREATE TABLE authorized_targets (
  id text PRIMARY KEY,
  origin text NOT NULL,
  product_path_prefix text NOT NULL,
  label text NOT NULL,
  fixture_version text,
  owner_reference text NOT NULL,
  permission_record text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quotes (
  id uuid PRIMARY KEY,
  target_id text NOT NULL REFERENCES authorized_targets(id),
  normalized_product_url text NOT NULL,
  profile text NOT NULL,
  viewports_json jsonb NOT NULL,
  price_amount_atomic bigint NOT NULL,
  asset text NOT NULL,
  network text NOT NULL,
  expires_at timestamptz NOT NULL,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id uuid PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES quotes(id),
  provider text NOT NULL,
  network text NOT NULL,
  payer text,
  settlement_reference text,
  state text NOT NULL CHECK (state IN ('VERIFIED', 'SETTLED', 'DENIED')),
  settled_at timestamptz,
  amount_atomic bigint NOT NULL,
  fingerprint text NOT NULL UNIQUE,
  safe_metadata_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inspections (
  id uuid PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES quotes(id),
  payment_id uuid NOT NULL REFERENCES payments(id),
  idempotency_key text NOT NULL,
  intent_hash text NOT NULL,
  payer text NOT NULL,
  target_id text NOT NULL REFERENCES authorized_targets(id),
  product_url text NOT NULL,
  profile text NOT NULL,
  client_reference text,
  status text NOT NULL,
  overall_verdict text CHECK (overall_verdict IN ('PASS', 'FAIL', 'INCONCLUSIVE')),
  error_code text,
  report_access_key_hash text NOT NULL,
  lease_owner text,
  lease_expires_at timestamptz,
  attempt_count int NOT NULL DEFAULT 0,
  deadline_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (quote_id),
  UNIQUE (payment_id, intent_hash),
  UNIQUE (payer, idempotency_key)
);
CREATE INDEX inspections_runnable ON inspections (queued_at) WHERE status = 'QUEUED';

CREATE TABLE viewport_runs (
  id uuid PRIMARY KEY,
  inspection_id uuid NOT NULL REFERENCES inspections(id),
  viewport text NOT NULL,
  browser_version text NOT NULL,
  fixture_version text,
  status text NOT NULL,
  verdict text,
  blocker text,
  attempts int NOT NULL,
  console_errors_json jsonb NOT NULL DEFAULT '[]',
  blocked_requests_json jsonb NOT NULL DEFAULT '[]',
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  first_blocker_step_id uuid,
  UNIQUE (inspection_id, viewport)
);

CREATE TABLE steps (
  id uuid PRIMARY KEY,
  viewport_run_id uuid NOT NULL REFERENCES viewport_runs(id),
  ordinal int NOT NULL,
  action text NOT NULL,
  expected_json jsonb NOT NULL,
  observed_json jsonb NOT NULL,
  result text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  decision_sentence text NOT NULL
);

CREATE TABLE events (
  id bigserial PRIMARY KEY,
  inspection_id uuid NOT NULL REFERENCES inspections(id),
  monotonic_sequence int NOT NULL,
  type text NOT NULL,
  details_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, monotonic_sequence)
);

CREATE TABLE artifacts (
  id uuid PRIMARY KEY,
  inspection_id uuid NOT NULL REFERENCES inspections(id),
  viewport_run_id uuid REFERENCES viewport_runs(id),
  kind text NOT NULL,
  label text NOT NULL,
  object_key text NOT NULL,
  mime_type text NOT NULL,
  bytes bigint NOT NULL,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  redaction_state text NOT NULL DEFAULT 'none'
);

CREATE TABLE worker_heartbeats (worker_id text PRIMARY KEY, seen_at timestamptz NOT NULL);

CREATE TABLE schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
