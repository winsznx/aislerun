The AisleRun API takes quotes, sells runs over x402, and serves results. All responses are JSON and every response carries a `request_id`.

## Base URL

```text
https://aislerun.158-220-85-120.sslip.io
```

There's no API key. The only paid route is `POST /v1/inspections`. Reads are authorized by each run's read token.

## Endpoints

| Method and path | Cost | Auth | Purpose |
| --- | --- | --- | --- |
| `GET /v1/meta` | free | none | Price, network, authorized stores, profiles |
| `POST /v1/quotes` | free | none | Get a quote |
| `POST /v1/inspections` | 0.05 USDC | x402 | Buy and start a run |
| `GET /v1/inspections/{id}` | free | read token | Status |
| `GET /v1/inspections/{id}/events?after=` | free | read token | Event stream |
| `GET /v1/reports/{id}` | free | read token | Full report |
| `GET /v1/reports/{id}/assets/{assetId}` | free | signed link | One evidence file, with range support |
| `GET /v1/comparisons/{before}/{after}` | free | both read tokens | Before and after |
| `GET /v1/demo/runs`, `/v1/demo/reports/{id}`, `/v1/demo/comparison` | free | none | Published runs only |
| `GET /healthz`, `GET /readyz` | free | none | Process health, and database plus worker readiness |

## Buy a run

```http
POST /v1/inspections
Content-Type: application/json
PAYMENT-SIGNATURE: <added by PayBox>

{
  "quote_id": "2d53bc4b-0464-4c6f-adba-8bffcbeab298",
  "product_url": "https://aislerun-fixtures.vercel.app/v/fixture-fixed-v2/products/cup",
  "authorized_target_id": "fixture-fixed-v2",
  "profile": "shopify_checkout_entry_v1",
  "idempotency_key": "6f1c2a9e-3c0b-4d51-9b8e-7a4f1e2d9c10",
  "client_reference": "optional, up to 128 characters"
}
```

Without `PAYMENT-SIGNATURE` the answer is `402` with a `PAYMENT-REQUIRED` header. Decoded, it asks for:

```json
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "amount": "50000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x50b174FAF12a7c7D6618Ac65D71DF613fEa0F57f",
    "maxTimeoutSeconds": 120
  }]
}
```

With a valid payment the answer is `200` with the run. See [Order your first run](/docs/quickstart#2-pay-for-the-run-with-paybox) for the full body.

## Errors

```json
{ "ok": false, "code": "TARGET_NOT_AUTHORIZED", "message": "Target not authorized: origin is not authorized for this target.", "retryable": false, "request_id": "req_…" }
```

| Code | Status | Meaning |
| --- | --- | --- |
| `INVALID_INPUT` | 400 | The body is malformed or has unknown fields |
| `TARGET_NOT_AUTHORIZED` | 403 | The store or URL isn't authorized |
| `QUOTE_EXPIRED` | 410 | The quote is older than 15 minutes |
| `QUOTE_SCOPE_MISMATCH` | 404, 409 | Unknown quote, or the body doesn't match it |
| `PAYMENT_UNVERIFIED` | 402 | No valid payment, or the amount doesn't match the quote |
| `IDEMPOTENCY_CONFLICT` | 409 | The quote was already used by a different request |
| `JOB_NOT_FOUND` | 404 | No such run |
| `REPORT_ACCESS_DENIED` | 401, 403 | Missing or wrong read token, or an expired evidence link |
| `RATE_LIMITED` | 429 | Too many requests, or the queue is full. Includes `Retry-After` |
| `INTERNAL_FAILURE` | 500 | AisleRun's own error. `retryable` is `true` |

Everything that can be refused before payment is refused without a `402`.

## Browsers and CORS

Read routes allow cross-origin requests only from `https://aislerun.vercel.app`. Agents and servers aren't affected by CORS.
