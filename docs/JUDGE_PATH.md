# Judge path

No wallet needed to review.

1. Open https://aislerun.158-220-85-120.sslip.io and press **Watch a real inspection**. The mobile recording shows Add to cart pressed and the cart staying at 0. The verdict bar shows mobile FAIL, desktop PASS and the payment settled on Base. Click a step in the timeline to jump the recording to it.
2. Press **Compare with the paid retest** (https://aislerun.158-220-85-120.sslip.io/demo/compare). It's a separate inspection of `fixture-fixed-v2`, paid separately. Mobile now reaches checkout entry. The table and the repair diff come from the stored run records and the fixture source.
3. **Demo** (https://aislerun.158-220-85-120.sslip.io/demo) lists all three paid runs with full IDs and settlement transactions.

## Verifying the paid path yourself

You need your own PayBox account and a wallet credential with about $0.10 of USDC on Base.

1. `npx @paybox-sh/sdk login`, then `npx @paybox-sh/sdk connect` to pair a signing key.
2. `npx @paybox-sh/sdk credentials --json` to find your wallet credential id.
3. `scripts/paybox-inspect.sh https://aislerun.158-220-85-120.sslip.io <credential-id> fixture-mobile-cart-broken-v1`

The script prints the quote, PayBox's payment status, each status change, the verdict and the settlement transaction, then a private `report_url` that only the read token opens. From an MCP-connected agent, use `use_service` with `method: "POST"`, the inspections URL and the body from the quote's `pay_with.body_template`.
