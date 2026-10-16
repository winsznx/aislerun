# Integration findings: PayBox and x402

Observed facts only. Each line names how it was observed. Assumptions are listed separately at the bottom.

## Environment (2026-10-16)

- PayBox CLI `@paybox-sh/sdk@2.2.0`, OAuth device login, signing key paired with `paybox connect`.
- Granted credential: one EVM wallet (`eth1`, `0x78c260d612932FD7F576095955ee7C850c787FCD`), approval mode `autonomous`.
- x402 server: `@x402/express@2.28.0`, `@x402/core@2.28.0`, `@x402/evm@2.28.0` (exact scheme, x402 v2).
- Facilitator: `https://facilitator.payai.network`. Its `/supported` lists `x402Version 2, exact, eip155:8453` and needs no API key. `https://x402.org/facilitator` lists testnets only.
- Network/asset: Base mainnet `eip155:8453`, USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Receiver `0x50b174FAF12a7c7D6618Ac65D71DF613fEa0F57f`.
- Public URL during the trials: a Cloudflare quick tunnel to the operator's Mac (that is the URL recorded in the trial traces). Since 2026-10-16 ~20:10 UTC the service runs on a VPS at https://aislerun.158-220-85-120.sslip.io (see `infra/vps/README.md`); the three paid runs and their evidence were migrated there unchanged.

## PayBox tool surface (docs.paybox.sh/reference/mcp-tools, read 2026-10-16)

- `use_service(credential_id, url, method?, body?, headers?)`: gateway mode. PayBox makes the unpaid request, reads the 402, signs, retries with payment, and returns the paid response. `body` is sent only on the paid retry and `headers` on both requests.
- `pay_x402(credential_id, accepts, resource_url, x402_version?, resource?)`: header mode. It returns a payment header for the caller to replay.
- `discover_services` only lists Bazaar services with at least 10 unique payers in 30 days. A new service will not appear there, but `use_service` accepts any URL.
- No developer publishing or registration API exists in the docs, OpenAPI (`api.paybox.sh/openapi.json`) or CLI. Marketplace listing is decided by MoonPay (developer.paybox.sh terms). We have not observed an AisleRun listing.

## Trial 1: unfunded, signer not paired (`docs/evidence/paybox/use-service-trial-1.json`)

- `use-service --method POST --body {...}` against `/v1/echo-paid`.
- PayBox fetched the 402 and parsed the **v2** `PAYMENT-REQUIRED` header (our body was `{}`). It built an EIP-3009 `TransferWithAuthorization` for exactly `10000` atomic USDC to our `payTo`.
- Result `status: pending_signature`, `next_action: stop / signer_unavailable`. No payment, no handler execution.
- PayBox echoed `resource.url` as `http://…` because Express did not trust the tunnel's `X-Forwarded-Proto`. Fixed with `app.set("trust proxy", true)`.

## Trial 2: funded, paired (`docs/evidence/paybox/use-service-trial-2.json`)

- Same call with `--wait`. Wall clock about 6.1 s.
- Server log: unpaid POST at 18:24:56.5Z, paid POST carrying `PAYMENT-SIGNATURE` at 18:24:57.4Z, `onAfterSettle` at 18:25:01.0Z.
- Settlement: `success: true`, tx `0xac05f7d1597a7197495c86fa39d7a2abcd6afac62238c9b02b76025e30f9e8d8`, Base block 52692877, receipt status `0x1`.
- Agent-facing result: `status: success`. `output.value.response` = `{status: 200, content_type, body, truncated: false}`. `payment.header_name: PAYMENT-SIGNATURE` and `header_available: false`, so **response headers are not passed to the agent. Everything the agent needs must be in the body.**
- `retry_requires_new_payment: false` is reported for a successful call.

## Consequences for the API contract

- `POST /v1/inspections` with a JSON body works through `use_service`. No method adapter needed.
- The paid response body carries `inspection_id`, `result_url`, `report_url` and a read token, since headers are dropped.
- The x402 Express middleware runs the handler **after verify and before settle**, then settles and only then flushes the response. AisleRun therefore creates the job as `AWAITING_SETTLEMENT` in the handler, and moves it to `QUEUED` only from `onAfterSettle`. A settle failure turns it into `PAYMENT_DENIED`. The worker never starts without a recorded settlement.
- Results are retrieved with free GET reads on `result_url` using the read token. The agent can fetch these with any HTTP tool. Whether a PayBox-hosted agent can do a plain GET is host-dependent and still needs to be checked per host.

## Not yet tested from a chat-hosted agent

Every paid call so far went through the PayBox CLI (`use-service`), which uses the same MCP `use_service` tool server-side. A call from an agent connected through PayBox's MCP connector (for example a claude.ai or Grok host) has not been made from this environment, because no PayBox MCP connector is attached here.

## Still unverified

- How (or whether) a non-MoonPay service is published to the PayBox marketplace.
- Behaviour of `use_service` when the paid handler returns 202 instead of 200 (we return 200 to avoid the question).
- Behaviour in `iframe` / `always_approve` approval modes.
- Body size limits on `use_service` responses (`truncated` flag exists; limit not observed).
