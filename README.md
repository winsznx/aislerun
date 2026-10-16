# AisleRun

Checkout testing your AI agent can order. An agent pays for one real browser run through PayBox (x402, USDC on Base). AisleRun opens an authorized product page in mobile and desktop Chromium, adds to cart, reaches the checkout entrance without submitting anything, and returns the recording, screenshots, a Playwright trace and the first step that broke.

Live (temporary tunnel, see Limitations): https://picked-function-browsers-exports.trycloudflare.com · [demo runs](https://picked-function-browsers-exports.trycloudflare.com/demo) · [API docs](https://picked-function-browsers-exports.trycloudflare.com/docs)

## What PayBox makes possible here

The merchant's own agent can find a specialist, see a price, and pay for exactly one inspection under the spending rules the merchant set in PayBox, with no account, API key or subscription at AisleRun. AisleRun never sees a wallet key. It only accepts a payment the x402 facilitator has verified, and it starts the browser only after that payment settles on-chain.

## The demo in three runs

All three are real PayBox-paid inspections of AisleRun's own labelled test store.

1. **Before the fix**, `fixture-mobile-cart-broken-v1`: mobile FAIL (`ADD_TO_CART_NO_EFFECT`, reproduced in two clean browser contexts), desktop PASS.
2. **After the fix**, `fixture-fixed-v2` (a one-line repair in `apps/fixtures/src/fixtures.ts`): PASS / PASS, paid for again.
3. **Control**, `fixture-healthy-v1`: PASS / PASS.

Settlement transactions and run IDs are in [docs/EVIDENCE_INDEX.md](docs/EVIDENCE_INDEX.md).

## How an agent orders a run

```
POST /v1/quotes        (free)  → quote_id, price 0.05 USDC on eip155:8453, expiry
POST /v1/inspections   (x402)  → paid through PayBox use_service; body returns inspection_id + read_token
GET  /v1/inspections/{id}      → poll with Authorization: Bearer <read_token>
GET  /v1/reports/{id}          → verdicts, steps, signed evidence URLs
```

To reproduce a paid run you need your own PayBox wallet credential with a little Base USDC:

```bash
npx paybox login && npx paybox connect
scripts/paybox-inspect.sh https://picked-function-browsers-exports.trycloudflare.com <credential-id> fixture-fixed-v2
```

## Run it locally

```bash
cp .env.example .env          # fill in secrets, receiver address and public URL
npm ci && npx playwright install chromium
docker compose up -d          # Postgres on 127.0.0.1:55432
cloudflared tunnel --url http://localhost:8790   # public URL for PayBox; put it in SERVICE_BASE_URL/WEB_BASE_URL
npm start                     # API + worker, migrations run on boot
npm test                      # unit + integration (needs DATABASE_URL and network)
```

Fixtures are a static site in `apps/fixtures`, deployed to https://aislerun-fixtures.vercel.app.

## Layout

```
apps/api          HTTP API, x402 middleware, report and public pages
apps/worker       leased Postgres job loop, evidence upload
apps/fixtures     synthetic storefront (healthy, mobile-broken, fixed, bot-check)
packages/inspection  Playwright journey and classifier
packages/shared   config, db, target allowlist, tokens, evidence store
packages/contracts  Zod schemas, statuses, error codes
db/migrations     Postgres schema
docs/             integration findings, sponsor behaviour, evidence index, build contract
```

## Limitations

- **Hosting**: the API, worker and Postgres run on the operator's Mac behind a Cloudflare quick tunnel. The public URL changes when the tunnel restarts and is only up while that machine is.
- **Marketplace**: AisleRun is reachable through PayBox `use_service` by URL. It is not listed in the PayBox marketplace, which MoonPay decides, and it won't show up in `discover_services`, which needs at least 10 payers.
- **Targets**: only the project's own synthetic fixtures are authorized. No real store has been tested.
- **Network fence**: the browser blocks every request outside the authorized origin, and the API checks that targets resolve to public addresses. There's no OS-level egress firewall in the local deployment.
- **Evidence** stays on a local disk volume, private, served through signed URLs that expire after 30 minutes. Deletion is manual.
- **Refunds**: a payment for a job that later fails internally is recorded but not refunded automatically.
- A PASS means this journey reached checkout once, in Chromium. It does not prove every buyer can check out.
