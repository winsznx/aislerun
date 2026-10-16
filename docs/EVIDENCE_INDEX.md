# Evidence index

Each claim maps to its proof. Run IDs resolve on the live deployment (see README) with the published read tokens on `/demo`.

| Claim | Evidence | Where |
|---|---|---|
| PayBox paid an x402 v2 endpoint we host | `use_service` success, settlement `0xac05f7d1597a7197495c86fa39d7a2abcd6afac62238c9b02b76025e30f9e8d8` (Base block 52692877, status 1) | `docs/evidence/paybox/use-service-trial-2.json`, [basescan](https://basescan.org/tx/0xac05f7d1597a7197495c86fa39d7a2abcd6afac62238c9b02b76025e30f9e8d8) |
| A PayBox-paid inspection caught the seeded mobile defect | Inspection `2c076b7f-3613-41c7-a5e3-6c46d7628f76`: mobile FAIL `ADD_TO_CART_NO_EFFECT` in 2 clean contexts, desktop PASS. Settlement `0xfb722e65302dc65afee313efbfa158a9af72e0ca51ea707e091d17bc3cc8d7e9` (block 52693184) | report `/runs/2c076b7f…`, [basescan](https://basescan.org/tx/0xfb722e65302dc65afee313efbfa158a9af72e0ca51ea707e091d17bc3cc8d7e9) |
| A separate paid retest passed after the fix | Inspection `f3f13c4c-e02d-441d-b08e-718a52c7b2eb` on `fixture-fixed-v2`: PASS / PASS. Settlement `0x0c9d639b2864fae449f42520e26c8c9ff8cc4d9bdcc47e7992fa40c16bda0757` | [basescan](https://basescan.org/tx/0x0c9d639b2864fae449f42520e26c8c9ff8cc4d9bdcc47e7992fa40c16bda0757) |
| Healthy control passes | Inspection `a06faa99-9443-41f2-8894-32140699ef4a` on `fixture-healthy-v1`: PASS / PASS. Settlement `0x1423cda7cf560ec6cbad24bce13150e36ff503ec5b33ceeb0fbd34233b35b7fa` | [basescan](https://basescan.org/tx/0x1423cda7cf560ec6cbad24bce13150e36ff503ec5b33ceeb0fbd34233b35b7fa) |
| The fix is a one-line change | `apps/fixtures/src/fixtures.ts`: `mobileBrokenDrawer` vs `sharedDrawer` | git history |
| Bot checks are INCONCLUSIVE, not FAIL | `fixture-bot-check-v1` → INCONCLUSIVE / `BROWSER_BLOCKED` on both viewports | `tests/worker.integration.test.ts` (not yet run through a paid call) |
| Unauthorized targets are refused before payment | 403 `TARGET_NOT_AUTHORIZED` for another origin, an IP literal, and a cross-fixture path. No quote row is created | `tests/api.integration.test.ts`, live check 2026-10-16 18:34 UTC |
| Unsigned paid request gets a native x402 challenge | 402 with v2 `PAYMENT-REQUIRED`: exact, eip155:8453, 50000 atomic USDC | `tests/api.integration.test.ts` |
| An invalid payment never creates a job | Payment signed by a fresh unfunded key is refused by the real facilitator with 402. Zero payment or inspection rows | `tests/api.integration.test.ts` |
| Retrying the same intent does not duplicate or recharge | Unpaid replay of inspection 2c076b7f's body returned the same ID with `replayed: true`. A different key on the same quote gets 409 | live check 2026-10-16, `tests/api.integration.test.ts` |
| A worker crash is a service failure, not a store verdict | A lease-expired job is re-run once on the same payment, then `FAILED_INTERNAL` with no verdict | `tests/worker.integration.test.ts` |
| Report links fail closed | No token gives 401. A tampered asset signature gives 403. Signed asset URLs expire after 30 min | live check, `tests/tokens.test.ts` |

Code at time of writing: `2b09143`. Wallet spend so far: $0.16 USDC over 4 paid calls (0.92 → 0.76).

## Not yet evidenced

- PayBox marketplace listing or discoverability of AisleRun. There's no publishing API, and listing is MoonPay's decision.
- A PayBox call made from a chat-hosted agent (MCP connector), rather than the PayBox CLI on the operator's machine.
- Behaviour in `iframe` / `always_approve` approval modes.
