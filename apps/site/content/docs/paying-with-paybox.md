AisleRun doesn't take cards or API keys. A run is paid for with one x402 request, and [PayBox](https://docs.paybox.sh) is how your agent makes that payment without ever holding a private key. PayBox enforces the approval mode and limits you set on your wallet, and AisleRun only ever sees a signed payment.

## The tool to use

Use PayBox's `use_service` tool. It makes the request, reads the 402, pays, retries, and hands the paid response back to the agent.

```text
use_service({
  credential_id: "<your wallet credential id>",
  url: "https://aislerun.158-220-85-120.sslip.io/v1/inspections",
  method: "POST",
  body: { "quote_id": "…", "product_url": "…", "authorized_target_id": "…",
          "profile": "shopify_checkout_entry_v1", "idempotency_key": "<stable uuid>" }
})
```

PayBox sends `body` only on the paid retry, so the unpaid first request is just the price check.

## What PayBox returns to the agent

PayBox returns the response body, not the headers. That's why everything the agent needs is in the body: the run ID, the read token, and both URLs. On success the PayBox result looks like this (trimmed):

```json
{
  "status": "success",
  "output": {
    "value": {
      "payment": { "status": "succeeded", "network": "eip155:8453", "scheme": "exact" },
      "response": { "status": 200, "content_type": "application/json; charset=utf-8", "body": "{\"ok\":true,\"inspection_id\":\"…\", …}" }
    }
  }
}
```

## What we observed

| Trial | Result |
| --- | --- |
| Wallet unfunded, signing key not paired | `pending_signature`, `signer_unavailable`. Nothing paid, nothing ran |
| Funded and paired | Paid and answered in about 6 seconds |
| Five paid runs | Each settled on Base within about a second of being verified |

All of these used PayBox's `autonomous` approval mode. The `iframe` and `always_approve` modes, where you confirm each payment, haven't been tried yet.

## If the payment doesn't go through

| What happened | What AisleRun does |
| --- | --- |
| The wallet can't pay | The facilitator rejects the signature. No payment or run is recorded |
| The payment is signed but the request is wrong | Refused before settlement, so the payment is cancelled and nothing is charged |
| The payment fails to settle | The run becomes `PAYMENT_DENIED` and no browser starts |
| The agent retries the same request | It gets the same run back without a new charge. See [Payments, retries and refunds](/docs/payments-and-refunds) |

## Discovery

AisleRun works with `use_service` by URL. It isn't listed in the PayBox marketplace, and it won't appear in `discover_services`, which only lists services with at least 10 different payers in 30 days.
