A run's report is private to whoever holds its read token. Evidence is stored on a private volume and served through links that expire. The operator can publish chosen runs, and nothing else becomes public.

## Who can read a run

Only someone with the run's read token. The token is returned once in the paid response, and again if the same request is retried. Without it, every read returns `401 REPORT_ACCESS_DENIED`. A comparison needs both runs' tokens.

The token sits after the `#` in `report_url`. Browsers never send that part to a server, so it doesn't show up in access logs or in the `Referer` header. AisleRun's pages also set `Referrer-Policy: no-referrer`.

## Evidence links

| Property | Value |
| --- | --- |
| Where files live | A private disk volume, never a public bucket |
| How they're served | Through the API, one signed link per file |
| Link lifetime | 30 minutes. Reload the report for fresh links |
| Scope | A link only works for its own run and file. Changing either breaks the signature |
| Integrity | Every file's size and SHA-256 are stored with it |

## Published runs

The operator can publish selected runs as a demo. Published runs are served through separate `/v1/demo` routes that never return a read token. Today the published runs are the four paid runs on the [test store](/docs/test-store), listed on the [proof page](/docs/proof).

## What AisleRun never collects

- Wallet keys, seed phrases or PayBox secrets. PayBox signs and AisleRun only sees the signed payment.
- Card numbers or any payment details.
- Shopper accounts, logins or personal data. The browser starts empty every time.

## What AisleRun does store

The payer's wallet address and the settlement transaction, both public on Base. The product URL that was tested. The recordings, screenshots, traces, steps and console errors from the run. Request IDs in the server logs. Retention is manual for now, and files are deleted by hand.
