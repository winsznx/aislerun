AisleRun only tests stores its operator has explicitly authorized. A URL being public isn't permission. Automated shopping on someone else's store without their consent is a problem whether or not the page is reachable.

## Who's authorized today

During the MoonPay hackathon the only authorized store is AisleRun's own [test store](/docs/test-store), one entry per version. `GET /v1/meta` lists them.

```sh
curl https://aislerun.158-220-85-120.sslip.io/v1/meta
```

Each authorized store is an origin plus a product path prefix, like `https://aislerun-fixtures.vercel.app` and `/v/fixture-fixed-v2/products/`. A quote for any other origin or path is refused.

## What a URL has to pass

| Check | Refused when |
| --- | --- |
| Scheme | It isn't HTTPS |
| Credentials | The URL has a username or password in it |
| Port | It isn't the default HTTPS port |
| Host | It's an IP address instead of a name |
| Origin and path | It isn't the authorized origin, or it's outside the product prefix, including encoded `..` tricks |
| DNS | The name resolves to a private, loopback, link-local or reserved address |

All of this happens at the quote and again before payment, so a refused store never costs anything and never starts a browser.

## How the browser is fenced in

The checks above stop a bad URL from being accepted. Three more layers stop the browser from reaching anything else once it's running.

1. **Every request is filtered.** Each page, script, image and redirect the browser asks for is checked against the authorized origin. Anything else is blocked and listed in the report under blocked requests.
2. **Redirects are checked.** If the page lands somewhere off the authorized store, the run stops as Inconclusive with `TARGET_LEFT_ALLOWLIST`.
3. **The network itself is fenced.** In production the browser's only route out is a network whose firewall drops private, loopback, link-local and cloud-metadata addresses, so even Chromium's own DNS can't reach them. A request to `169.254.169.254` from inside the container times out.

## What the browser never does

- Log in, create an account or read an account page.
- Type anything into checkout, payment or shipping forms.
- Submit an order.
- Get past CAPTCHAs or bot checks. Those end the run as [Inconclusive](/docs/verdicts).
- Treat text on the store's page as instructions. Page content is data, never a command.

> Testing real merchant stores would need proof of ownership, such as a DNS or HTML verification, plus the merchant's consent. That isn't built yet. See [Limitations](/docs/limitations).
