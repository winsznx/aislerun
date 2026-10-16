A retest is a second, separately paid run of the same product page after you change something. The two runs stay separate, each with its own recording, steps and payment, and the comparison puts them side by side.

## Run a retest

Ask for a new quote and pay for it the same way as the first run. A quote buys exactly one run, so the retest always has its own quote, its own idempotency key and its own settlement.

## Compare two runs

Open the comparison in the browser:

```text
https://aislerun.vercel.app/runs/{before}/compare/{after}#before=rt_…&after=rt_…
```

The page needs both runs' read tokens. An agent can read the same comparison as JSON:

```sh
curl -H "X-Read-Tokens: rt_before…,rt_after…" \
  https://aislerun.158-220-85-120.sslip.io/v1/comparisons/{before}/{after}
```

## What can be compared

| Rule | Why |
| --- | --- |
| Same store origin and the same product | Otherwise the difference could be the page, not the fix |
| Different runs | A run compared with itself proves nothing |
| The second run is newer | A retest comes after the change |
| Both runs finished with stored evidence | There's nothing to compare otherwise |

The store version can differ between the two runs. On the test store that difference is the fix itself.

## What the comparison shows

- Both recordings, each with its own controls. "Play both from the start" starts them together, but they aren't synchronised frame by frame.
- A table of what changed: each viewport's verdict, whether the cart was confirmed, whether checkout opened, attempts, run time and both settlements.
- On the test store, the actual code change between the broken and fixed versions.

## The published example

[Before and after](/demo/compare) compares run `2c076b7f` on the broken store, where mobile failed twice, with run `f3f13c4c` on the fixed store, where both viewports reached checkout. Each was paid for separately through PayBox.

> A pass after a fix means this journey reached checkout in this run. It doesn't prove every buyer can now check out, and AisleRun makes no claim about recovered revenue.
