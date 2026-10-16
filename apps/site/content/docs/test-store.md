The test store is a small storefront AisleRun built for itself at `https://aislerun-fixtures.vercel.app`. It looks and behaves like a Shopify product page, and every page says in its footer that it's a test fixture. It's the only store AisleRun is authorized to test today.

## The four versions

Each version lives at its own fixed path, so a result always names exactly what it tested.

| Version | What it does | Expected result |
| --- | --- | --- |
| `fixture-healthy-v1` | Normal product, cart and checkout | Pass on both viewports |
| `fixture-mobile-cart-broken-v1` | Add to cart throws an error below 750 px wide | Mobile fails, desktop passes |
| `fixture-fixed-v2` | The one-line repair of that bug | Pass on both viewports |
| `fixture-bot-check-v1` | A human-verification wall instead of the product | Inconclusive on both viewports |

Product pages are at `/v/<version>/products/cup`, and the cart and checkout pages follow the same pattern.

## The seeded defect

On the broken version, the Add to cart handler looks for a cart drawer that doesn't exist on narrow screens. It throws before the cart is saved, so nothing happens when a phone shopper presses the button. The fix makes both screen sizes use the same drawer.

```diff
- var isMobile = window.matchMedia("(max-width: 749px)").matches;
-     return document.getElementById(isMobile ? "CartDrawer-mobile" : "CartDrawer");
+ return document.getElementById("CartDrawer");
```

The browser console shows the real error: `Cannot set properties of null (setting 'hidden')`. AisleRun reports it as a possible cause, not a diagnosis.

## How the store tracks the cart

The cart lives in the browser's local storage, keyed by version. The header shows a cart count and the cart drawer lists each line, which gives AisleRun its two cart signals. The checkout page collects nothing and has no submit button.

## Results so far

Every version has been run through a real paid inspection. See [Live proof](/docs/proof).
