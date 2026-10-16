Every claim in these docs is backed by a run you can open. These are all the paid runs so far, each bought through PayBox and settled in USDC on Base.

## Paid runs

| Run | Store version | Mobile | Desktop | Settlement |
| --- | --- | --- | --- | --- |
| [2c076b7f](/demo/runs/2c076b7f-3613-41c7-a5e3-6c46d7628f76) | broken | Fail, `ADD_TO_CART_NO_EFFECT`, 2 attempts | Pass | [0xfb722e65…](https://basescan.org/tx/0xfb722e65302dc65afee313efbfa158a9af72e0ca51ea707e091d17bc3cc8d7e9) |
| [f3f13c4c](/demo/runs/f3f13c4c-e02d-441d-b08e-718a52c7b2eb) | fixed | Pass | Pass | [0x0c9d639b…](https://basescan.org/tx/0x0c9d639b2864fae449f42520e26c8c9ff8cc4d9bdcc47e7992fa40c16bda0757) |
| [a06faa99](/demo/runs/a06faa99-9443-41f2-8894-32140699ef4a) | healthy | Pass | Pass | [0x1423cda7…](https://basescan.org/tx/0x1423cda7cf560ec6cbad24bce13150e36ff503ec5b33ceeb0fbd34233b35b7fa) |
| [aaebdec9](/demo/runs/aaebdec9-46b2-4bd3-8665-7ae67541b656) | bot check | Inconclusive, `BROWSER_BLOCKED` | Inconclusive, `BROWSER_BLOCKED` | [0x4229a68b…](https://basescan.org/tx/0x4229a68b5c2d82ff9e9c87c9cb96f92f63b8c39c16109ae1692dd72dfec30f2e) |
| fad7f747 | broken, after moving hosts | Fail, `ADD_TO_CART_NO_EFFECT` | Pass | [0x78b3576c…](https://basescan.org/tx/0x78b3576ceddee01e061fc7474d7c790adbbe2ab1d84a55601b30bbfa18aa3623) |

The last run is private. It was the regression check after production moved to its current server.

## The first PayBox payment

Before any browser work existed, a 0.01 USDC test route was paid through PayBox to confirm the integration. It settled in [0xac05f7d1…](https://basescan.org/tx/0xac05f7d1597a7197495c86fa39d7a2abcd6afac62238c9b02b76025e30f9e8d8), Base block 52692877.

## Timings

| Run | Verified to settled | Settled to first step | Settled to finished |
| --- | --- | --- | --- |
| 2c076b7f | 0.9 s | 3.2 s | 18.5 s |
| f3f13c4c | 0.9 s | 1.8 s | 6.8 s |
| a06faa99 | 1.1 s | 2.4 s | 7.4 s |

The failing run takes longer because the mobile journey waits 4 seconds for the cart to change, twice. Three runs aren't enough for a p95, so none is given.

## Check it yourself

- Open any run above to watch the recording and read each step.
- Open a settlement on Basescan and check the transfer of 0.05 USDC to `0x50b174FAF12a7c7D6618Ac65D71DF613fEa0F57f`.
- Compare the broken and fixed runs on [Before and after](/demo/compare).
- Read the live price and authorized stores from [`/v1/meta`](https://aislerun.158-220-85-120.sslip.io/v1/meta).
