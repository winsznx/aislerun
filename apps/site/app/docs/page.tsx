import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Tag } from "@/components/Tag";
import { API_URL } from "@/lib/api";
import styles from "../marketing.module.css";

export const metadata: Metadata = { title: "Docs", description: "How an agent quotes, pays through PayBox and reads AisleRun inspection results." };

const FIXTURES = "https://aislerun-fixtures.vercel.app";

export default function DocsPage() {
  return (
    <div className={styles.page}>
      <SiteHeader current="docs" />
      <main id="main" className={`container ${styles.docs}`}>
        <nav className={styles.docsNav} aria-label="On this page">
          <a href="#scope">What it tests</a>
          <a href="#quote">1. Quote</a>
          <a href="#pay">2. Pay with PayBox</a>
          <a href="#read">3. Read results</a>
          <a href="#verdicts">Verdicts</a>
          <a href="#errors">Errors</a>
          <a href="#paybox">What PayBox proves</a>
          <a href="#limits">Limitations</a>
        </nav>
        <article className={styles.docsBody}>
          <span className="eyebrow"><span className="mark" aria-hidden="true">✳</span>API</span>
          <h1 style={{ marginTop: 24 }}>Order a shopper test from an agent</h1>
          <p>
            One paid run opens an authorized product page in Chromium on a 390 × 844 phone and a 1440 × 900 desktop, adds the item to the cart, and opens checkout without submitting anything. The API lives at <code>{API_URL}</code>.
          </p>

          <section id="scope">
            <h2>What it tests and who is authorized</h2>
            <p>
              Only stores on the operator&apos;s allowlist can be inspected, and a public URL isn&apos;t treated as permission. During the hackathon that means AisleRun&apos;s own labelled fixtures at <code>{FIXTURES}</code>: <code>fixture-healthy-v1</code>, <code>fixture-mobile-cart-broken-v1</code>, <code>fixture-fixed-v2</code> and <code>fixture-bot-check-v1</code>. <code>GET /v1/meta</code> lists the current targets and price.
            </p>
          </section>

          <section id="quote">
            <h2>1. Get a quote (free)</h2>
            <pre><code>{`POST ${API_URL}/v1/quotes
Content-Type: application/json

{
  "product_url": "${FIXTURES}/v/fixture-fixed-v2/products/cup",
  "authorized_target_id": "fixture-fixed-v2",
  "profile": "shopify_checkout_entry_v1",
  "viewports": ["mobile", "desktop"]
}`}</code></pre>
            <p>
              The response has a <code>quote_id</code>, an <code>expires_at</code> 15 minutes out, the price (0.05 USDC on <code>eip155:8453</code>) and a ready-made <code>pay_with.body_template</code>. A store that isn&apos;t authorized gets <code>403 TARGET_NOT_AUTHORIZED</code> here, before any payment.
            </p>
          </section>

          <section id="pay">
            <h2>2. Pay and start with PayBox</h2>
            <p>The paid route is an x402 v2 resource. Without payment it answers 402 with a <code>PAYMENT-REQUIRED</code> header. From a PayBox-connected agent, call the MCP tool <code>use_service</code>:</p>
            <pre><code>{`use_service({
  credential_id: "<your PayBox wallet credential>",
  url: "${API_URL}/v1/inspections",
  method: "POST",
  body: {
    "quote_id": "…",
    "product_url": "…",
    "authorized_target_id": "…",
    "profile": "shopify_checkout_entry_v1",
    "idempotency_key": "<stable uuid>"
  }
})`}</code></pre>
            <p>PayBox hands the response body back to the agent, not the headers, so everything the agent needs is in the body:</p>
            <pre><code>{`{
  "ok": true,
  "inspection_id": "f3f13c4c-…",
  "status": "AWAITING_SETTLEMENT",
  "result_url": "${API_URL}/v1/inspections/f3f13c4c-…",
  "read_token": "rt_…",
  "report_url": "https://<this site>/runs/f3f13c4c-…#token=…",
  "poll_after_ms": 2000,
  "payment": { "state": "VERIFIED", "reference": null }
}`}</code></pre>
            <p>
              The status reads <code>AWAITING_SETTLEMENT</code> because the body is written before the payment settles. The browser starts only after settlement, which took about a second in our runs. Sending the same body again returns the same job without a second charge. A different key on a used quote gets <code>409 IDEMPOTENCY_CONFLICT</code>.
            </p>
          </section>

          <section id="read">
            <h2>3. Read the result (free, token-scoped)</h2>
            <pre><code>{`GET ${API_URL}/v1/inspections/{id}          Authorization: Bearer <read_token>
GET ${API_URL}/v1/inspections/{id}/events?after=<cursor>
GET ${API_URL}/v1/reports/{id}`}</code></pre>
            <p>Poll every two seconds until <code>terminal</code> is true. Our paid runs finished 7 to 19 seconds after settlement. Evidence links inside a report are signed and stop working after 30 minutes.</p>
          </section>

          <section id="verdicts">
            <h2>Verdicts</h2>
            <div className={styles.docTable}>
              <div><span><Tag tone="pass">Pass</Tag></span><span>The cart count and the cart contents both changed, and checkout opened.</span></div>
              <div><span><Tag tone="fail">Fail</Tag></span><span>A blocker reproduced in two separate clean browsers, such as <code>ADD_TO_CART_NO_EFFECT</code> or <code>CHECKOUT_ENTRY_BLOCKED</code>.</span></div>
              <div><span><Tag tone="unsure">Inconclusive</Tag></span><span>The journey couldn&apos;t be judged: a bot check, an unavailable product, or controls AisleRun doesn&apos;t recognise.</span></div>
              <div><span><Tag tone="neutral">Service error</Tag></span><span><code>FAILED_INTERNAL</code> or <code>CANCELLED</code> are AisleRun&apos;s own failures and never count against the store. A crashed run is retried once on the same payment.</span></div>
            </div>
          </section>

          <section id="errors">
            <h2>Errors</h2>
            <p>
              Errors look like <code>{`{ ok: false, code, message, retryable, request_id }`}</code>. Codes are <code>INVALID_INPUT</code>, <code>TARGET_NOT_AUTHORIZED</code>, <code>QUOTE_EXPIRED</code>, <code>QUOTE_SCOPE_MISMATCH</code>, <code>PAYMENT_UNVERIFIED</code>, <code>IDEMPOTENCY_CONFLICT</code>, <code>JOB_NOT_FOUND</code>, <code>REPORT_ACCESS_DENIED</code>, <code>RATE_LIMITED</code> and <code>INTERNAL_FAILURE</code>. Anything that can be refused before payment, like the target, the quote or a full queue, is refused without a payment challenge.
            </p>
          </section>

          <section id="paybox">
            <h2>What PayBox proves</h2>
            <p>
              PayBox holds the wallet and enforces your approval mode and limits, and AisleRun never sees a key. A settled payment proves the run was bought by that wallet. It says nothing about whether the store passed. AisleRun is reachable through <code>use_service</code> by URL. It isn&apos;t listed in the PayBox marketplace and doesn&apos;t appear in <code>discover_services</code>.
            </p>
          </section>

          <section id="limits">
            <h2>Limitations</h2>
            <ul className={styles.docList}>
              <li>Checkout entry only. No order, payment details or login.</li>
              <li>Chromium only, two viewport sizes, one product journey.</li>
              <li>A pass shows the journey worked once. It doesn&apos;t prove every buyer can check out.</li>
              <li>A payment for a run that later fails internally is recorded but not refunded automatically.</li>
              <li>Evidence is private and deleted by hand. Published demo runs are chosen by the operator.</li>
            </ul>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
