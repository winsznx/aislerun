This page walks through one paid run the way an agent does it: a free quote, one paid request through PayBox, then free reads until the run finishes. Every request and response below is the real shape returned by the API at `https://aislerun.158-220-85-120.sslip.io`.

## What you need

- A [PayBox](https://docs.paybox.sh) account with a wallet credential granted to your agent or CLI.
- About 0.10 USDC on Base in that wallet. One run costs 0.05 USDC.
- A product page on an [authorized store](/docs/authorized-stores). Today that means one of AisleRun's [test store versions](/docs/test-store).

## 1. Get a quote

The quote is free. It tells you the price, what's covered and when the offer expires, and it refuses a store that isn't authorized before anything is charged.

```sh
curl -X POST https://aislerun.158-220-85-120.sslip.io/v1/quotes \
  -H 'content-type: application/json' \
  -d '{
    "product_url": "https://aislerun-fixtures.vercel.app/v/fixture-mobile-cart-broken-v1/products/cup",
    "authorized_target_id": "fixture-mobile-cart-broken-v1",
    "profile": "shopify_checkout_entry_v1"
  }'
```

The parts of the response you use next:

```json
{
  "quote_id": "9ac09ba8-1517-4589-af12-762cf700ad75",
  "expires_at": "2026-10-16T18:49:59.816Z",
  "price": { "amount": "0.05", "amount_atomic": "50000", "asset_symbol": "USDC", "network": "eip155:8453" },
  "pay_with": {
    "method": "POST",
    "url": "https://aislerun.158-220-85-120.sslip.io/v1/inspections",
    "body_template": {
      "quote_id": "9ac09ba8-1517-4589-af12-762cf700ad75",
      "product_url": "https://aislerun-fixtures.vercel.app/v/fixture-mobile-cart-broken-v1/products/cup",
      "authorized_target_id": "fixture-mobile-cart-broken-v1",
      "profile": "shopify_checkout_entry_v1",
      "idempotency_key": "<your stable uuid>"
    }
  }
}
```

## 2. Pay for the run with PayBox

Fill in `idempotency_key` with a UUID you keep for this run, then have PayBox call the paid URL. From an agent connected to PayBox's MCP server:

```text
use_service({
  credential_id: "<your wallet credential id>",
  url: "https://aislerun.158-220-85-120.sslip.io/v1/inspections",
  method: "POST",
  body: { ...pay_with.body_template, "idempotency_key": "<your stable uuid>" }
})
```

From the PayBox CLI it's the same request:

```sh
npx @paybox-sh/sdk use-service --wait \
  --credential <your wallet credential id> \
  --method POST \
  --url https://aislerun.158-220-85-120.sslip.io/v1/inspections \
  --body @body.json
```

PayBox reads the payment request, signs a 0.05 USDC transfer from your wallet, and sends the request again with the payment attached. In our runs this took about 6 seconds. The agent gets the response body back:

```json
{
  "ok": true,
  "inspection_id": "2c076b7f-3613-41c7-a5e3-6c46d7628f76",
  "status": "AWAITING_SETTLEMENT",
  "result_url": "https://aislerun.158-220-85-120.sslip.io/v1/inspections/2c076b7f-3613-41c7-a5e3-6c46d7628f76",
  "read_token": "rt_…",
  "report_url": "https://aislerun.vercel.app/runs/2c076b7f-3613-41c7-a5e3-6c46d7628f76#token=rt_…",
  "poll_after_ms": 2000,
  "payment": { "state": "VERIFIED", "reference": null }
}
```

> The status says `AWAITING_SETTLEMENT` because this body is written before the payment lands on Base. The browser only starts after it does, about a second later.

## 3. Wait for the result

Poll `result_url` with the read token every two seconds until `terminal` is true.

```sh
curl -H "Authorization: Bearer rt_…" \
  https://aislerun.158-220-85-120.sslip.io/v1/inspections/2c076b7f-3613-41c7-a5e3-6c46d7628f76
```

```json
{ "status": "COMPLETED", "terminal": true, "overall_verdict": "FAIL",
  "viewports": [
    { "viewport": "mobile", "verdict": "FAIL", "blocker": "ADD_TO_CART_NO_EFFECT", "attempts": 2 },
    { "viewport": "desktop", "verdict": "PASS", "blocker": null, "attempts": 1 } ] }
```

## 4. Open the report

Give a person the `report_url`. It opens the run in the browser with the recording, the steps and the payment. The token lives after the `#`, so it never reaches a server log. An agent can read the same data as JSON from `GET /v1/reports/{id}`. See [Reading results](/docs/reading-results).

## Do it in one command

The repository has a script that does all four steps with the PayBox CLI and prints each status change:

```sh
scripts/paybox-inspect.sh https://aislerun.158-220-85-120.sslip.io <credential id> fixture-mobile-cart-broken-v1
```
