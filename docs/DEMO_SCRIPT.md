# Demo script

Real footage only. Every run, payment and recording below already exists and is linked. Nothing in the film is staged except the test store itself, which is labelled on screen.

## Assets

| Use | Where | Real source |
| --- | --- | --- |
| Landing hero | https://aislerun.vercel.app | Recording of run 2c076b7f, attempt 2 |
| Failed run report | https://aislerun.vercel.app/demo/runs/2c076b7f-3613-41c7-a5e3-6c46d7628f76 | Paid, tx 0xfb722e65302dc65afee313efbfa158a9af72e0ca51ea707e091d17bc3cc8d7e9 |
| Retest report | https://aislerun.vercel.app/demo/runs/f3f13c4c-e02d-441d-b08e-718a52c7b2eb | Paid, tx 0x0c9d639b2864fae449f42520e26c8c9ff8cc4d9bdcc47e7992fa40c16bda0757 |
| Before and after | https://aislerun.vercel.app/demo/compare | Both runs above |
| Bot check | https://aislerun.vercel.app/demo/runs/aaebdec9-46b2-4bd3-8665-7ae67541b656 | Paid, tx 0x4229a68b5c2d82ff9e9c87c9cb96f92f63b8c39c16109ae1692dd72dfec30f2e |
| The fix | `apps/fixtures/src/fixtures.ts`, `mobileBrokenDrawer` vs `sharedDrawer` | git history |
| Before/after GIF | `docs/media/before-after.gif` | The two recordings, real time |

## Shot list (about 2:15)

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | Landing hero, the real recording playing, cart stays at 0 | "Your store can load and buying can still break. This is a real recording: Add to cart is pressed and the cart stays at zero." |
| 0:12 | Label "Real recording, controlled test store" in frame | "It's our own labelled test store with a defect we seeded on purpose." |
| 0:20 | Docs home, the agent panel with the inspections URL | "AisleRun is a shopper test an AI agent can order." |
| 0:30 | Terminal: `scripts/paybox-inspect.sh` against production on `fixture-mobile-cart-broken-v1` (records a new paid run live, 0.05 USDC) | "The agent gets a free quote, then PayBox pays one x402 request from the wallet. No account, no API key." |
| 0:50 | Script output: `paid: succeeded`, status changes, verdict, settlement | "The browser only starts after the payment settles on Base." |
| 1:00 | Basescan page for that settlement | "Here's the payment." |
| 1:08 | The run's report: verdict tiles, first blocker, click "Cart checked" so the video jumps | "Mobile fails, desktop passes. It failed twice in clean browsers, and here's the console error as raw evidence." |
| 1:30 | The fix in `fixtures.ts` | "The fix is one line." |
| 1:40 | Before and after page, press "Play both from the start" | "A second, separately paid run of the same page. Mobile now reaches checkout." |
| 1:58 | The diff table and both settlement links | "Two runs, two payments, both on Base." |
| 2:05 | Runs page with all four paid runs, including the bot check as inconclusive | "Bot checks come back inconclusive, never as a store failure." |
| 2:12 | Wordmark | "AisleRun. Checkout testing your AI agent can order." |

## Truth rules for the film

- The live paid segment at 0:30 uses the PayBox CLI, which is what was verified end to end. Don't present it as a claude.ai or ChatGPT chat unless that path is completed and recorded for real.
- Keep "controlled test store" visible whenever the store is on screen.
- Say "reached checkout entry", never "completed checkout".
- No revenue or conversion numbers.
- Label any speed-up on screen. The recordings in the product are real time.
