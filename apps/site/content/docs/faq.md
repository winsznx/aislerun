## What does AisleRun actually do?

It opens a product page in Chromium on a phone and a desktop, adds the item to the cart, checks the cart really changed, and opens checkout without submitting anything. Then it tells you, per screen size, whether that worked, with the recording to prove it.

## Does it buy anything?

No. It never fills in checkout, payment or shipping details and never places an order. The run stops at the checkout entrance.

## Why does an AI agent need to pay for it?

So the agent looking after a store can order a test when it needs one, without an account, an API key or a subscription. PayBox lets the agent pay from your wallet under the limits you set, and AisleRun only accepts a payment that a facilitator has verified.

## How much does a run cost?

0.05 USDC on Base, for both screen sizes. Network gas is covered by the facilitator. `GET /v1/meta` returns the live price.

## How long does it take?

In our runs PayBox paid in about 6 seconds, the payment settled about a second later, and the run finished 7 to 19 seconds after that. A failing run takes longer because AisleRun repeats it to make sure.

## Can I test my own store?

Not yet. During the hackathon only AisleRun's own [test store](/docs/test-store) is authorized. Testing real stores needs proof that you own them, which isn't built.

## Is a pass a guarantee my checkout works?

No. A pass means this journey reached checkout once, in Chromium, on two screen sizes. See [Limitations](/docs/limitations).

## Why did a run come back inconclusive instead of failed?

Because AisleRun couldn't judge it. Bot checks, out-of-stock products, unfamiliar page controls and pages that don't load are all inconclusive. AisleRun only says Fail when it saw the store break, twice. See [Verdicts and blockers](/docs/verdicts).

## What if AisleRun itself breaks during my run?

The run is retried once on the same payment. If it breaks again, it ends as a service error with no store verdict. You aren't charged twice, and refunds for service errors are handled by hand.

## What if my agent sends the paid request twice?

It gets the same run back without a second charge, as long as the quote and idempotency key are the same. See [Payments, retries and refunds](/docs/payments-and-refunds).

## Who can see my results?

Only someone with the run's read token, which comes back once in the paid response. Evidence links expire after 30 minutes. See [Privacy and evidence](/docs/privacy-and-evidence).

## Is AisleRun in the PayBox marketplace?

No. Any PayBox agent can use it through `use_service` by URL, but it isn't listed in the marketplace and doesn't show up in `discover_services`.

## Does a language model decide the verdict?

No. The journey is a fixed script and the verdict comes from fixed rules. The only AI involved is the agent that orders the run.
