A run has three parts: a free quote, a paid request that only queues work once the payment settles, and a browser job that writes everything it sees to the run's event log. Nothing on the report is written after the fact. Every status, step and verdict comes from a row the worker stored while it ran.

## The payment gate

The paid route is an [x402](https://www.x402.org) resource. A request without payment gets HTTP 402 and a `PAYMENT-REQUIRED` header describing the price. PayBox signs a USDC transfer and retries with a `PAYMENT-SIGNATURE` header.

| Stage | What AisleRun does | Status |
| --- | --- | --- |
| Before payment | Checks the body, the quote and the store. Refuses without asking for payment if any of them is wrong | none created |
| Payment verified | The facilitator confirms the signature and balance. AisleRun records the payment and creates the run | `AWAITING_SETTLEMENT` |
| Payment settled | The transfer lands on Base. Only now does the run join the queue | `QUEUED` |
| Settlement failed | No browser work ever starts | `PAYMENT_DENIED` |

The facilitator is [PayAI](https://facilitator.payai.network), and payments settle in USDC on Base mainnet (`eip155:8453`).

## The worker

One worker takes queued runs from Postgres, one at a time, and holds a lease while it works. If a worker dies mid-run, the next one picks the run up once the lease expires and runs it again on the same payment. That happens at most once. A second failure ends the run as a service error, and you're never charged twice. See [Payments, retries and refunds](/docs/payments-and-refunds).

## The browser journey

For each viewport, the worker opens a fresh Chromium context with no cookies or stored data and follows the same steps.

1. **Load** the product page and check it's still on the authorized store.
2. **Ready**: find the product title and price, and check it's in stock.
3. **Variant**: choose the first available option if the product has any.
4. **Add to cart**: find the control by test ID, then by the Shopify form, then by its accessible name, and press it.
5. **Confirm the cart**: wait up to 4 seconds for two separate signals, the cart count going up and a cart line appearing.
6. **Checkout entry**: press Check out and confirm the checkout page opens. Nothing is filled in or submitted.

If the cart doesn't change, the worker repeats the whole journey once in a new, clean browser. A failure is only reported when it happens both times.

The phone runs at 390 × 844 with touch and a 3× pixel ratio, and the desktop runs at 1440 × 900. Mobile runs first.

## Evidence

Each attempt records a video, screenshots before and after the important steps, and a Playwright trace. When both viewports finish, the files are stored on a private volume with their size and SHA-256, and only then does the run become `COMPLETED` or `INCONCLUSIVE`. A run with no stored evidence never shows a verdict.

## The statuses you'll see

| Status | Meaning |
| --- | --- |
| `AWAITING_SETTLEMENT` | Paid, waiting for the payment to settle |
| `QUEUED` | Settled, waiting for the worker |
| `STARTING` | The worker is launching Chromium |
| `RUNNING_MOBILE`, `RUNNING_DESKTOP` | The journey is running on that viewport |
| `UPLOADING_EVIDENCE` | Storing recordings, screenshots and traces |
| `COMPLETED` | Finished with a pass or fail |
| `INCONCLUSIVE` | Finished, but the journey couldn't be judged |
| `FAILED_INTERNAL`, `CANCELLED` | AisleRun's own failure or time limit. Never a store verdict |
| `PAYMENT_DENIED` | The payment didn't settle, so nothing ran |
