# AisleRun

Your store can load and buying can still break. AisleRun is a shopper test an AI agent can order: the agent pays for one real browser run through PayBox (x402, USDC on Base), and AisleRun opens an authorized product page in mobile and desktop Chromium, adds to cart, reaches the checkout entrance without submitting anything, and returns the recording, screenshots, a Playwright trace and the first step that broke.

![Before: mobile Add to cart leaves the cart at 0 (red). After the one-line repair: the same journey reaches checkout (green).](docs/media/before-after.gif)

*Left: run AR-2C076B7F, mobile FAIL `ADD_TO_CART_NO_EFFECT`. Right: run AR-F3F13C4C, mobile PASS. Two separate PayBox-paid runs on AisleRun's controlled test fixture, real-time Playwright recordings.*

**Live:** https://aislerun.vercel.app · API https://aislerun.158-220-85-120.sslip.io · [demo runs](https://aislerun.vercel.app/demo) · [before and after](https://aislerun.vercel.app/demo/compare) · [API docs](https://aislerun.vercel.app/docs)

## Review it in three clicks

1. Open https://aislerun.vercel.app and press **Watch a real inspection**. The mobile recording shows Add to cart pressed and the cart staying at 0. The first blocker, the raw console error and the payment's Base transaction are on the same screen.
2. Press **Compare with the retest**. Two independent paid inspections side by side, a table of what changed, and the actual one-line repair.
3. Open **Runs** for all four paid runs (broken, repaired, healthy control, bot check) with full run IDs and settlement links.

No wallet is needed to review. Every target is AisleRun's own labelled fixture and no purchase is ever placed.

## What PayBox makes possible here

The merchant's own agent can find a specialist, see a price, and pay for exactly one inspection under the spending rules the merchant set in PayBox, with no account, API key or subscription at AisleRun. AisleRun never sees a wallet key. It only accepts a payment the x402 facilitator verified, and starts the browser only after that payment settles on-chain.

## The three paid runs

| Run | Fixture | Mobile | Desktop | Settlement |
|---|---|---|---|---|
| `2c076b7f-3613-41c7-a5e3-6c46d7628f76` | broken | FAIL `ADD_TO_CART_NO_EFFECT` (2 clean attempts) | PASS | [`0xfb722e65…`](https://basescan.org/tx/0xfb722e65302dc65afee313efbfa158a9af72e0ca51ea707e091d17bc3cc8d7e9) |
| `f3f13c4c-e02d-441d-b08e-718a52c7b2eb` | fixed (one-line repair) | PASS | PASS | [`0x0c9d639b…`](https://basescan.org/tx/0x0c9d639b2864fae449f42520e26c8c9ff8cc4d9bdcc47e7992fa40c16bda0757) |
| `a06faa99-9443-41f2-8894-32140699ef4a` | healthy control | PASS | PASS | [`0x1423cda7…`](https://basescan.org/tx/0x1423cda7cf560ec6cbad24bce13150e36ff503ec5b33ceeb0fbd34233b35b7fa) |

More in [docs/EVIDENCE_INDEX.md](docs/EVIDENCE_INDEX.md).

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
scripts/paybox-inspect.sh https://aislerun.158-220-85-120.sslip.io <credential-id> fixture-fixed-v2
```

## Run it locally

```bash
cp .env.example .env          # fill in secrets, receiver address and public URL
npm ci && npx playwright install chromium
docker compose up -d          # Postgres on 127.0.0.1:55432
npm start                     # API + worker, migrations run on boot
npm test                      # unit + integration (needs DATABASE_URL and network)
```

Fixtures are a static site in `apps/fixtures`, deployed to https://aislerun-fixtures.vercel.app.

## Layout

```
apps/api          HTTP API, x402 middleware, report adapter (VPS)
apps/site         Next.js web app: landing, runs, report console, compare, docs (Vercel)
apps/worker       leased Postgres job loop, evidence upload
apps/fixtures     synthetic storefront (healthy, mobile-broken, fixed, bot-check)
packages/inspection  Playwright journey and classifier
packages/shared   config, db, target allowlist, tokens, evidence store
packages/contracts  Zod schemas, statuses, error codes
db/migrations     Postgres schema
docs/             integration findings, sponsor behaviour, evidence index, build contract
```

## Limitations

- **Hosting**: the web app is on Vercel; the API, worker, Chromium and Postgres run as one Docker stack on a shared VPS behind Caddy (see `infra/vps/`), on an sslip.io hostname rather than a custom domain.
- **Marketplace**: AisleRun is reachable through PayBox `use_service` by URL. It is not listed in the PayBox marketplace, which MoonPay decides, and it won't show up in `discover_services`, which needs at least 10 payers.
- **Targets**: only the project's own synthetic fixtures are authorized. No real store has been tested.
- **Network fence**: the browser blocks every request outside the authorized origin, the API checks that targets resolve to public addresses, and in production the container's only route out is an iptables-fenced network that drops private and metadata addresses.
- **Evidence** stays on a private disk volume, served through signed URLs that expire after 30 minutes. Only runs listed in `DEMO_RUNS` are readable without a token. Deletion is manual.
- **Refunds**: a payment for a job that later fails internally is recorded but not refunded automatically.
- A PASS means this journey reached checkout once, in Chromium. It does not prove every buyer can check out.
