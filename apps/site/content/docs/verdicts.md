Each viewport gets its own verdict, and the run's overall verdict is the worst of them. A verdict comes from fixed rules over what the browser observed. No language model writes or adjusts it.

## The three verdicts

| Verdict | When |
| --- | --- |
| Pass | The cart count and the cart contents both changed, and the checkout page opened |
| Fail | Add to cart did nothing in two separate clean browsers, or the item reached the cart but checkout couldn't be opened |
| Inconclusive | The journey couldn't be judged, for example a bot check or an unavailable product |

The overall verdict is Fail if any viewport failed, Inconclusive if any viewport couldn't be judged, and Pass only when both passed.

## Blockers

| Code | Verdict | What the browser saw |
| --- | --- | --- |
| `ADD_TO_CART_NO_EFFECT` | Fail | Add to cart was pressed and neither cart signal changed, twice |
| `CHECKOUT_ENTRY_BLOCKED` | Fail | The item was in the cart but no checkout control was reachable, or pressing it didn't open checkout |
| `BROWSER_BLOCKED` | Inconclusive | The page answered with a bot check or an access refusal |
| `PRODUCT_UNAVAILABLE` | Inconclusive | The product or every variant was out of stock |
| `UNSUPPORTED_MARKUP` | Inconclusive | No recognisable Add to cart control, or only one of the two cart signals changed |
| `NAVIGATION_FAILED` | Inconclusive | The page didn't load or returned an error status |
| `TARGET_LEFT_ALLOWLIST` | Inconclusive | The page redirected off the authorized store, so the run stopped |

## Why a cart failure needs two attempts

A single failed click can be a slow network or a race in the page. When the cart doesn't change, AisleRun runs the whole journey again in a new browser with nothing carried over. It only reports Fail if the second attempt fails the same way. The report says how many attempts there were and keeps the recordings of both.

## Why a cart change needs two signals

A click alone proves nothing. AisleRun waits up to 4 seconds for the cart count to go up and a cart line to appear. If only one of them changes, the result is Inconclusive, not Pass.

## Service errors are not verdicts

If AisleRun itself breaks, the run ends as `FAILED_INTERNAL`, or `CANCELLED` if it hits the 150-second limit. These have no store verdict and never count against the store.

## Observed versus cause

The report keeps what happened apart from why. "Add to cart was clicked but the cart did not change" is an observation. A console error like `Cannot set properties of null (setting 'hidden')` is shown as a possible cause, word for word, and AisleRun doesn't claim a root cause it hasn't proven.
