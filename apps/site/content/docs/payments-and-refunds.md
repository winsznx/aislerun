One run costs 0.05 USDC, paid on Base through x402. Money only moves when a paid request is valid and the run can start, and a retried request never charges twice.

## The price

| | |
| --- | --- |
| Price per run | 0.05 USDC (50,000 atomic units) |
| Network | Base mainnet, `eip155:8453` |
| Asset | USDC, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Scheme | x402 v2 `exact` |
| Network gas | Paid by the facilitator, not by you |

`GET /v1/meta` returns the live price. The price covers both viewports.

## When money moves

Nothing is charged for a quote, a refusal, a status read or a report. A payment is only settled after AisleRun has accepted the request and created the run. If anything fails between the payment being verified and the run being created, the payment is cancelled before it settles.

## Retries and duplicates

Send the same body again, with the same quote and the same `idempotency_key`, and you get the original run back, with `"replayed": true` and no payment request. This is safe to do when a response was lost.

| You send | You get |
| --- | --- |
| Same quote, same key, same body | The original run, no charge |
| Same quote, different key | `409 IDEMPOTENCY_CONFLICT`, no charge |
| Two paid requests for one quote at the same moment | One run. The second payment is cancelled before it settles |

## When a run fails after you paid

| What happened | What you get |
| --- | --- |
| The store failed | A Fail verdict. That's the product working |
| The page couldn't be judged | An Inconclusive verdict with the reason |
| The worker crashed | The same run is retried once on the same payment, with no new charge |
| It crashed again, or hit the 150-second limit | `FAILED_INTERNAL` or `CANCELLED`, with no store verdict |

> Refunds aren't automatic. A payment for a run that ended as a service error is recorded with its settlement, and a refund is handled by hand.

## Abuse limits

| Limit | Value |
| --- | --- |
| Quotes | 30 a minute per address |
| Paid requests | 120 a minute per address |
| Report reads | 240 a minute per address |
| Queue | 10 waiting runs. Beyond that, new paid requests are refused with `RATE_LIMITED` before any payment is requested |
