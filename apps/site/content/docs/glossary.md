## Authorized store

A store origin and product path that the operator has allowed AisleRun to test. See [Authorized stores](/docs/authorized-stores).

## Blocker

The first step that stopped the shopper, with a code such as `ADD_TO_CART_NO_EFFECT`. See [Verdicts and blockers](/docs/verdicts).

## Checkout entry

The first page of checkout. A run reaches it and stops. Nothing is filled in or submitted.

## Clean browser

A new Chromium context with no cookies, storage or history. Every attempt uses one.

## Event

One thing the worker recorded while a run was going, such as a step starting or finishing. Events are what the live view and the report are built from.

## Facilitator

The service that checks an x402 payment and submits it to the blockchain. AisleRun uses PayAI's facilitator.

## Fixture

A version of AisleRun's own [test store](/docs/test-store), such as `fixture-mobile-cart-broken-v1`.

## Idempotency key

A value you choose for one paid request. Sending the same request with the same key returns the original run instead of starting and charging for a new one.

## Inconclusive

A result that means the journey couldn't be judged. It's never counted as a store failure.

## PayBox

MoonPay's wallet for AI agents. It holds your keys and limits and pays x402 requests for your agent. See [Paying with PayBox](/docs/paying-with-paybox).

## Quote

A free, 15-minute offer for one run of one product page at a fixed price. See [Quotes](/docs/quotes).

## Read token

The secret that lets you read one run. It comes back in the paid response and starts with `rt_`.

## Retest

A second, separately paid run of the same product page, usually after a fix. See [Retests and comparisons](/docs/retests).

## Service error

A run that ended because AisleRun failed, shown as `FAILED_INTERNAL` or `CANCELLED`. It has no store verdict.

## Settlement

The moment a payment lands on Base. AisleRun queues a run only after settlement.

## Use service

PayBox's `use_service` tool. It calls a paid URL, pays the 402, and returns the paid response to the agent.

## Viewport

The screen size a run uses: mobile at 390 × 844 or desktop at 1440 × 900.

## x402

An open protocol for paying for an HTTP request. The server answers `402 Payment Required` with a price, and the client retries with a signed payment.
