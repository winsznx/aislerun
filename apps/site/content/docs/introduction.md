AisleRun is a shopper test your AI agent can order. Your agent pays for one run through [PayBox](https://docs.paybox.sh), and AisleRun opens your product page in a real browser on a phone and on a desktop, adds the item to the cart, opens checkout, and stops there. You get a verdict for each screen size, the recording of what the browser did, and the first step that broke.

## Who it's for

AisleRun is for merchants and the agencies or AI agents that look after their stores. A store can load fine and still lose sales at the last click: a cart button that does nothing on phones, a checkout link that goes nowhere. Those bugs rarely show up in uptime checks, and spot-checking every release by hand doesn't scale.

## The problem it solves

### A page that loads isn't a page that sells

Monitoring tells you the server answered. It doesn't tell you a shopper could put something in the cart. AisleRun runs the purchase path itself, in Chromium, the way a shopper would.

### Evidence instead of opinions

Every result comes with the recording, screenshots, a [Playwright](https://playwright.dev) trace and the raw console output. A verdict is never written by a language model. It comes from a fixed script and fixed rules, so the same page gives the same answer.

### Proving a fix

After a fix, the agent pays for a second run of the same page. The two runs sit [side by side](/docs/retests), each with its own recording and payment, so you can see the outcome changed.

## What you can do today

| You want to | Read |
| --- | --- |
| Order a run from an agent | [Order your first run](/docs/quickstart) |
| Understand a result | [Verdicts and blockers](/docs/verdicts) |
| Check a fix | [Retests and comparisons](/docs/retests) |
| Wire it into your own tools | [API](/docs/api) |
| See it working | [Live proof](/docs/proof) |

> During the MoonPay hackathon AisleRun only tests its own labelled test store. A public URL isn't treated as permission to test a store. See [Authorized stores](/docs/authorized-stores).

## Where to go next

Start with [Order your first run](/docs/quickstart), or read [How a run works](/docs/how-it-works) for what happens between the payment and the report.
