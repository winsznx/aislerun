# Judge path

No wallet needed to review.

1. Open https://picked-function-browsers-exports.trycloudflare.com and press **View the failed run**. The mobile recording shows Add to cart pressed and the cart staying at 0. The first blocker is shown at the top with the raw console error.
2. Check the provenance panel at the bottom: payment SETTLED, the Base settlement tx (links to basescan), fixture build, browser version.
3. Go back and press **See the paid retest**. That's a separate inspection, paid separately, of `fixture-fixed-v2`. Mobile and desktop both reach checkout.

`/demo` lists all three published runs with their settlement transactions.

## Verifying the paid path yourself

You need your own PayBox account and a wallet credential with about $0.10 of USDC on Base.

1. `npx @paybox-sh/sdk login`, then `npx @paybox-sh/sdk connect` to pair a signing key.
2. `npx @paybox-sh/sdk credentials --json` to find your wallet credential id.
3. `scripts/paybox-inspect.sh https://picked-function-browsers-exports.trycloudflare.com <credential-id> fixture-mobile-cart-broken-v1`

The script prints the quote, PayBox's payment status, each status change and the final verdict, plus the settlement transaction. From an MCP-connected agent, use `use_service` with `method: "POST"`, the inspections URL and the body from the quote's `pay_with.body_template`.
