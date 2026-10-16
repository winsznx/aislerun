# PayBox behaviour, as measured

All numbers come from the trials and runs listed here, on 2026-10-16, with PayBox CLI 2.2.0 in `autonomous` approval mode, the PayAI facilitator and Base mainnet. Three paid inspections is not enough for a p95, so none is given.

## use_service trials

| Trial | Setup | PayBox result | Wall clock |
|---|---|---|---|
| 1 | Wallet unfunded, signing key not paired | `pending_signature`, `next_action: stop / signer_unavailable`. PayBox had already parsed our v2 challenge and built the EIP-3009 authorization | under 1 s |
| 2 | Funded, paired, `/v1/echo-paid` ($0.01) | `success`, HTTP 200 body returned verbatim, settlement `0xac05f7d1…e8d8` | 6.1 s |
| 3 | Paid inspection, broken fixture ($0.05) | `success`, inspection `2c076b7f…` | 6 s (18:35:08 → 18:35:14 UTC) |
| 4 | Paid inspection, fixed fixture | `success`, inspection `f3f13c4c…` | about 6 s |
| 5 | Paid inspection, healthy fixture | `success`, inspection `a06faa99…` | about 6 s |

In `autonomous` mode no approval prompt appeared. The `iframe` and `always_approve` modes have not been observed.

## Inside AisleRun (from the `events` table)

| Inspection | Fixture | Verify → settled | Queued → worker start | Queued → first recorded step | Queued → terminal | Verdict |
|---|---|---:|---:|---:|---:|---|
| 2c076b7f | fixture-mobile-cart-broken-v1 | 904 ms | 943 ms | 3.2 s | 18.5 s | FAIL (mobile reproduced twice) |
| f3f13c4c | fixture-fixed-v2 | 873 ms | 36 ms | 1.8 s | 6.8 s | PASS |
| a06faa99 | fixture-healthy-v1 | 1055 ms | 365 ms | 2.4 s | 7.4 s | PASS |

The failing run takes longer because the mobile journey waits 4 s for the cart to change, twice. That wait is the confirmation budget, not slowness.

## What this means for the agent experience

- The paid call returns in about 6 s with an inspection ID. The result arrives 7 to 19 s after that, so an agent should poll `result_url` every 2 s. That interval matches what was observed.
- The paid response body is written before settlement, so it honestly says `AWAITING_SETTLEMENT` / `VERIFIED`. By the agent's first poll the job has already moved to `QUEUED` or further.
- PayBox does not forward response headers to the agent (`header_available: false`), so everything the agent needs is in the body.
