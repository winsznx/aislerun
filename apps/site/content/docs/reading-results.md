Reading a run is free. Every read needs the run's read token, which comes back in the paid response. There are three views of the same run: its status, its event stream, and the full report.

## The read token

The token is `read_token` in the paid response. Send it as a bearer token.

```text
Authorization: Bearer rt_…
```

The same token is in `report_url` after the `#`, so the browser keeps it to itself and it never reaches a server log. Retrying the same paid request returns the same token, which is why a lost response isn't a lost run.

## Status

```sh
curl -H "Authorization: Bearer rt_…" https://aislerun.158-220-85-120.sslip.io/v1/inspections/{id}
```

| Field | Meaning |
| --- | --- |
| `status` | Where the run is. See [How a run works](/docs/how-it-works#the-statuses-you-ll-see) |
| `terminal` | `true` once the run won't change again |
| `overall_verdict` | `PASS`, `FAIL` or `INCONCLUSIVE` once terminal, otherwise `null` |
| `viewports` | Each viewport's verdict, blocker and attempt count |
| `last_event` | The most recent thing the worker recorded |
| `elapsed_ms` | Time since the worker started |
| `poll_after_ms` | `2000` until terminal |

Our paid runs finished 7 to 19 seconds after settlement. Two seconds between polls matches that.

## Events

The event stream is what the worker wrote down as it went, in order. Use the cursor to read only what's new.

```sh
curl -H "Authorization: Bearer rt_…" \
  "https://aislerun.158-220-85-120.sslip.io/v1/inspections/{id}/events?after=14"
```

```json
{ "events": [
  { "seq": 15, "type": "step_started", "details": { "viewport": "mobile", "step": "confirm_cart" } },
  { "seq": 16, "type": "step_finished", "details": { "viewport": "mobile", "step": "confirm_cart",
    "observed": "Add to cart was clicked but the cart did not change." } },
  { "seq": 17, "type": "retrying", "details": { "viewport": "mobile",
    "cause_effect": "Click Add to cart → cart state unchanged → retrying once" } } ],
  "next_cursor": 17 }
```

## The report

`GET /v1/reports/{id}` returns the whole run once it's finished.

| Part | What's in it |
| --- | --- |
| `viewports[].steps` | Each step's expected outcome, what was observed, the result, timings, and its offset into the recording |
| `viewports[].recording` | The recording of the final attempt, with a poster image |
| `viewports[].artifacts` | Every screenshot, recording and trace, each with its size and SHA-256 |
| `viewports[].console_errors` | Raw console errors from the page. Shown as evidence, never as a diagnosis |
| `payment` | Amount, network and the settlement transaction on Base |
| `fixture_disclosure` | Present when the store is AisleRun's test store |
| `limitations` | What this result can't tell you |

Every evidence URL in a report is signed and stops working after 30 minutes. Fetch the report again for fresh links. Recordings support HTTP range requests, so video players can seek.

## In the browser

Open `report_url` to see the same run as a page: the recording beside the first blocker, steps you can click to jump the recording, and the payment. While the run is still going, the page shows what's happening now, what it's waiting on, and what comes next, all from the event stream.
