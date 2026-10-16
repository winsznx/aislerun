AisleRun answers one narrow question well: could a shopper get this product into the cart and reach checkout, in this browser, right now? Here's what a run can't tell you, and what isn't built yet.

## What a result can't tell you

- **Checkout completion.** The run stops at the checkout entrance. Payment forms, shipping, discounts and order placement are never touched.
- **Every buyer's experience.** A pass is one run in Chromium on two screen sizes. Other browsers, devices, locations and logged-in shoppers can behave differently.
- **Why something broke.** AisleRun reports what it observed and shows console errors as raw evidence. It doesn't claim a root cause.
- **Revenue.** A failed run doesn't measure lost sales, and a passing retest doesn't measure recovered ones.

## What isn't built yet

| Missing | Today |
| --- | --- |
| Real merchant stores | Only AisleRun's own [test store](/docs/test-store) is authorized |
| Store ownership checks | No DNS or HTML verification yet |
| Other journeys | One profile, `shopify_checkout_entry_v1` |
| Other browsers | Chromium only |
| Automatic refunds | Payments for service errors are refunded by hand |
| PayBox marketplace listing | Reachable through `use_service` by URL, not listed in the marketplace |
| Other approval modes | Only tested with PayBox's `autonomous` mode |
| Evidence retention | Kept until deleted by hand |

## Hosting

The web app runs on Vercel. The API, worker, Chromium and Postgres run as one Docker stack on a shared server, at an `sslip.io` hostname rather than a custom domain.
