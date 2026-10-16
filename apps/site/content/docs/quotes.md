A quote is a free promise of what one run will cover and cost. It names the store, the product page, the journey and the price, and it expires after 15 minutes. The paid request has to match its quote exactly.

## Ask for a quote

```sh
curl -X POST https://aislerun.158-220-85-120.sslip.io/v1/quotes \
  -H 'content-type: application/json' \
  -d '{
    "product_url": "https://aislerun-fixtures.vercel.app/v/fixture-fixed-v2/products/cup",
    "authorized_target_id": "fixture-fixed-v2",
    "profile": "shopify_checkout_entry_v1",
    "viewports": ["mobile", "desktop"]
  }'
```

| Field | Required | Notes |
| --- | --- | --- |
| `product_url` | yes | An HTTPS product page on the authorized store. The query string and fragment are dropped |
| `authorized_target_id` | yes | The store's ID from `GET /v1/meta` |
| `profile` | yes | Always `shopify_checkout_entry_v1` for now |
| `viewports` | no | `["mobile", "desktop"]` by default. One of them is allowed |

## What comes back

| Field | Meaning |
| --- | --- |
| `quote_id` | Pass this in the paid request |
| `expires_at` | 15 minutes after the quote was made |
| `price` | Amount, atomic amount, asset and network |
| `scope` | `product`, `cart`, `checkout_entry` |
| `estimated_duration_text` | What we measured, not a promise |
| `pay_with` | The paid URL and a body template with everything filled in except `idempotency_key` |

## When a quote is refused

A refused quote never charges anything and never starts a browser.

| Code | Why |
| --- | --- |
| `TARGET_NOT_AUTHORIZED` | The store isn't on the list, the URL is outside its product pages, the host is an IP address, or it doesn't resolve to a public address |
| `INVALID_INPUT` | A missing or unknown field, or a URL that isn't HTTPS |
| `RATE_LIMITED` | More than 30 quotes a minute from one address |

## How the paid request uses the quote

Before asking for payment, AisleRun checks the paid body against the quote. If the product URL, store or profile differ, it answers `409 QUOTE_SCOPE_MISMATCH`. If the quote expired, it answers `410 QUOTE_EXPIRED`. Neither asks for payment. A quote can buy exactly one run. Using it again with a different idempotency key gets `409 IDEMPOTENCY_CONFLICT`.
