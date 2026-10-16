import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { VerdictTag } from "@/components/Tag";
import { RunList } from "@/components/RunList";
import { getDemoRuns } from "@/lib/api";
import { actionText, verdictWord, viewportSummary } from "@/lib/status";
import { usdc } from "@/lib/format";
import styles from "./marketing.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const runs = await getDemoRuns();
  const failed = runs.find((r) => r.role === "failed")?.report;
  const mobile = failed?.viewports.find((v) => v.viewport === "mobile");
  const price = failed?.payment ? usdc(failed.payment.amount_atomic) : "0.05 USDC";

  return (
    <div className={styles.page}>
      <SiteHeader current="home" />
      <main id="main">
        <section className={`container ${styles.hero}`}>
          <span className="eyebrow"><span className="mark" aria-hidden="true">✳</span>Shopper tests your AI agent can order</span>
          <h1>Your store can load. Buying can still break.</h1>
          <p className={styles.heroLede}>
            Your agent pays for one real browser run through PayBox. AisleRun shops the product page on a phone and a desktop, stops at checkout, and hands back the recording and the first step that broke.
          </p>
          <div className={styles.actions}>
            <Link className="button" href={failed ? `/demo/runs/${failed.inspection_id}` : "/demo"}>Watch a real inspection</Link>
            <Link className="button secondary" href="/demo/compare">See the paid retest</Link>
          </div>

          <div className={styles.heroPanels}>
            <div className={`${styles.panelArt} ${styles.artNeutral}`}>
              <p className={styles.panelKicker}>What one run checks</p>
              <div className={styles.floatCard}>
                <ol className={styles.checks}>
                  {["Product page loads with a price", "Add to cart changes the cart", "The cart lists the item", "Checkout opens, nothing submitted"].map((c, i) => (
                    <li key={c}><span className={styles.checkNum}>{i + 1}</span>{c}</li>
                  ))}
                </ol>
                <p className={styles.floatFoot}>On a 390 × 844 phone and a 1440 × 900 desktop</p>
              </div>
            </div>

            <div className={`${styles.panelArt} ${styles.artViolet}`}>
              {failed && mobile?.recording ? (
                <>
                  <div className={styles.device}>
                    <video src={mobile.recording.url} poster={mobile.recording.poster_url ?? undefined} autoPlay muted loop playsInline preload="auto" aria-label={`Real mobile recording of run ${failed.run_label}`} />
                  </div>
                  <div className={`${styles.floatCard} ${styles.resultCard}`}>
                    <div className={styles.resultHead}>
                      <span>Mobile · {failed.run_label}</span>
                      <VerdictTag verdict={mobile.verdict}>{verdictWord(mobile.verdict)}</VerdictTag>
                    </div>
                    <strong>{viewportSummary(mobile)}</strong>
                    <ul className={styles.resultSteps}>
                      {mobile.steps.slice(-3).map((s) => (
                        <li key={s.ordinal}><span className={`${styles.resultDot} ${s.result === "FAIL" ? styles.dotFail : ""}`} aria-hidden="true" />{actionText(s.action)}</li>
                      ))}
                    </ul>
                    <p className={styles.floatFoot}>Reproduced in {mobile.attempts} clean browsers</p>
                  </div>
                  <div className={styles.paidChip}>
                    <span className={styles.paidIcon} aria-hidden="true">$</span>
                    <span><strong>{price}</strong> paid through PayBox</span>
                  </div>
                  <span className={styles.realLabel}>Real recording · controlled test store</span>
                </>
              ) : (
                <p className={styles.panelKicker}>Recordings appear here once runs are published.</p>
              )}
            </div>
          </div>
        </section>

        <section className={`container ${styles.section}`} id="how">
          <span className="eyebrow"><span className="mark" aria-hidden="true">✳</span>How it works</span>
          <div className={styles.sectionHeading}>
            <h2>Your agent orders the test. PayBox pays for it.</h2>
            <p>No account, API key or subscription at AisleRun. The agent asks for a price, pays one x402 request from your PayBox wallet under your own limits, and gets evidence back.</p>
          </div>
          <div className={styles.features}>
            <article className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true"><TagIcon /></span>
              <h3>Get a quote</h3>
              <p>The agent names an authorized product page and gets a fixed price, scope and expiry. Stores that aren&apos;t authorized are refused here, before any charge.</p>
            </article>
            <article className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true"><WalletIcon /></span>
              <h3>Pay with PayBox</h3>
              <p>PayBox signs a {price} payment on Base. The browser only starts after it settles, and a retried request never charges twice.</p>
            </article>
            <article className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true"><PlayIcon /></span>
              <h3>Watch the evidence</h3>
              <p>A pass, fail or inconclusive for each screen size, with the recording, screenshots, a Playwright trace and the exact step that stopped the shopper.</p>
            </article>
          </div>
        </section>

        <section className={`container ${styles.section}`}>
          <span className="eyebrow"><span className="mark" aria-hidden="true">✳</span>Every published run</span>
          <div className={styles.sectionHeading}>
            <h2>Caught, fixed, and checked again.</h2>
            <p>Each of these is a separate inspection a PayBox-connected agent paid for, on AisleRun&apos;s own labelled test store. Open any of them to watch what the browser saw.</p>
          </div>
          <RunList runs={runs} />
          <div className={styles.listFoot}>
            <Link className="button" href="/demo/compare">Compare broken and repaired</Link>
            <Link className="button secondary" href="/demo">All runs</Link>
          </div>
        </section>

        <section className={`container ${styles.section}`}>
          <div className={styles.scope}>
            <div className={styles.scopePanel}>
              <h3>What a run checks</h3>
              <ul>
                <li>The product page loads and shows a price</li>
                <li>Add to cart changes both the cart count and the cart contents</li>
                <li>The cart leads to the checkout entrance</li>
                <li>All of it on a phone and a desktop viewport</li>
              </ul>
            </div>
            <div className={styles.scopePanel}>
              <h3>What it never does</h3>
              <ul>
                <li>Enter payment details or place an order</li>
                <li>Test a store that isn&apos;t on the authorized list</li>
                <li>Get past bot checks. Those come back inconclusive, not failed</li>
                <li>Promise every real buyer can check out</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function TagIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7-8.3-8.3Z" /><circle cx="8" cy="8" r="1.4" /></svg>;
}
function WalletIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V7.5Zm0 0V6a1.5 1.5 0 0 1 1.5-1.5H16" /><circle cx="16" cy="13.5" r="1.2" fill="currentColor" /></svg>;
}
function PlayIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="3" /><path d="m10 9 5 3-5 3V9Z" /></svg>;
}
