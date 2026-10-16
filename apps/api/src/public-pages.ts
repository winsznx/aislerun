import type { Config } from "../../../packages/shared/src/config.js";
import type { Db } from "../../../packages/shared/src/db.js";
import { deriveReadToken, signAssetUrl } from "../../../packages/shared/src/tokens.js";

// Canonical runs the operator chose to publish (DEMO_RUNS="failed:<id>,retest:<id>,control:<id>").
// Publishing means their read tokens appear in public links; nothing else becomes public.
export interface DemoRun {
  role: string;
  id: string;
  label: string;
  createdAt: string;
  status: string;
  verdict: string | null;
  fixtureVersion: string | null;
  productUrl: string;
  settlement: string | null;
  viewports: Array<{ viewport: string; verdict: string; blocker: string | null }>;
  mobileVideoUrl: string | null;
  reportUrl: string;
}

export function parseDemoRuns(raw: string | undefined): Array<{ role: string; id: string }> {
  if (!raw) return [];
  return raw
    .split(",")
    .map((pair) => pair.trim().split(":"))
    .filter((p): p is [string, string] => p.length === 2 && /^[0-9a-f-]{36}$/.test(p[1] ?? ""))
    .map(([role, id]) => ({ role, id }));
}

export async function loadDemoRuns(db: Db, config: Config, refs: Array<{ role: string; id: string }>): Promise<DemoRun[]> {
  const runs: DemoRun[] = [];
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  for (const ref of refs) {
    const { rows } = await db.query(
      `SELECT i.id, i.created_at, i.status, i.overall_verdict, i.product_url, t.fixture_version, p.settlement_reference
       FROM inspections i JOIN authorized_targets t ON t.id = i.target_id JOIN payments p ON p.id = i.payment_id
       WHERE i.id = $1 AND p.state = 'SETTLED'`,
      [ref.id],
    );
    const row = rows[0];
    if (!row) continue;
    const viewports = await db.query("SELECT id, viewport, verdict, blocker FROM viewport_runs WHERE inspection_id = $1 ORDER BY viewport DESC", [ref.id]);
    const video = await db.query(
      `SELECT a.id FROM artifacts a JOIN viewport_runs v ON v.id = a.viewport_run_id
       WHERE a.inspection_id = $1 AND v.viewport = 'mobile' AND a.kind = 'video' ORDER BY a.label DESC LIMIT 1`,
      [ref.id],
    );
    const videoId = video.rows[0]?.id as string | undefined;
    runs.push({
      role: ref.role,
      id: row.id,
      label: `AR-${String(row.id).slice(0, 8).toUpperCase()}`,
      createdAt: new Date(row.created_at).toISOString(),
      status: row.status,
      verdict: row.overall_verdict,
      fixtureVersion: row.fixture_version,
      productUrl: row.product_url,
      settlement: row.settlement_reference,
      viewports: viewports.rows.map((v) => ({ viewport: v.viewport, verdict: v.verdict, blocker: v.blocker })),
      mobileVideoUrl: videoId ? `/v1/reports/${row.id}/assets/${videoId}?exp=${exp}&sig=${signAssetUrl(config.REPORT_TOKEN_SECRET, row.id, videoId, exp)}` : null,
      reportUrl: `/runs/${row.id}#token=${deriveReadToken(config.REPORT_TOKEN_SECRET, row.id)}`,
    });
  }
  return runs;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const STYLE = `
:root{--canvas:#F6F6F2;--panel:#FFFFFF;--ink:#191D1C;--muted:#676F6B;--border:#DCDFD9;--pos:#1E7352;--neg:#B33E35;--warn:#966413;--info:#2D5E86}
@media (prefers-color-scheme:dark){:root{--canvas:#121514;--panel:#1A1E1D;--ink:#ECEEEA;--muted:#9AA29E;--border:#2C3230;--pos:#4FB287;--neg:#E0766C;--warn:#D6A54A;--info:#7AA7D1}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.55 Geist,Inter,system-ui,sans-serif}
a{color:var(--info)}a:focus-visible,button:focus-visible{outline:2px solid var(--info);outline-offset:3px;border-radius:4px}
.wrap{max-width:1120px;margin:0 auto;padding:0 16px}
nav{display:flex;justify-content:space-between;align-items:center;padding:20px 0}
.wordmark{font-weight:650;font-size:19px;letter-spacing:-.01em;color:var(--ink);text-decoration:none}
nav .links{display:flex;gap:20px;font-size:15px}nav .links a{color:var(--muted);text-decoration:none}nav .links a:hover{color:var(--ink)}
.hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:48px;align-items:center;padding-top:40px;padding-bottom:56px}
h1{font-size:clamp(34px,5.2vw,56px);line-height:1.05;letter-spacing:-.025em;font-weight:620;margin:0 0 20px;max-width:13ch}
.lede{font-size:18px;color:var(--muted);max-width:46ch;margin:0 0 28px}
.cta{display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-block;padding:12px 18px;border-radius:10px;font-weight:600;text-decoration:none;border:1px solid var(--ink)}
.btn.primary{background:var(--ink);color:var(--canvas)}.btn.secondary{color:var(--ink)}
.pair{display:flex;gap:16px}
figure{margin:0;width:206px}
.phone{position:relative;border-radius:26px;padding:8px;background:var(--ink)}
.phone video{display:block;width:190px;aspect-ratio:390/844;border-radius:19px;background:#000;object-fit:cover}
figcaption{font-size:13px;color:var(--muted);margin-top:10px;line-height:1.4}
.verdict{display:inline-block;font-weight:700;font-size:13px;padding:2px 9px;border-radius:999px;border:1.5px solid currentColor;margin-bottom:4px}
.verdict.FAIL{color:var(--neg)}.verdict.PASS{color:var(--pos)}.verdict.INCONCLUSIVE{color:var(--warn)}
.tx{font-family:"Geist Mono",ui-monospace,monospace;font-size:12px}
section{padding:48px 0;border-top:1px solid var(--border)}
h2{font-size:24px;letter-spacing:-.015em;margin:0 0 24px;font-weight:620}
ol.how{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px;counter-reset:s}
ol.how li{counter-increment:s}ol.how li::before{content:counter(s);display:block;font-size:40px;font-weight:300;color:var(--muted);line-height:1;margin-bottom:12px}
ol.how h3{margin:0 0 6px;font-size:17px}ol.how p{margin:0;color:var(--muted);max-width:34ch}
table{width:100%;border-collapse:collapse;font-size:15px}
th,td{text-align:left;padding:12px 10px;border-bottom:1px solid var(--border);vertical-align:top}th{color:var(--muted);font-weight:500}
td .tx{word-break:break-all}
.limits{color:var(--muted);max-width:68ch;padding-left:18px;margin:0}.limits li{margin-bottom:6px}
.note{font-size:14px;color:var(--warn);border:1px solid var(--warn);border-radius:10px;padding:10px 14px;max-width:68ch}
footer{padding:32px 0 48px;color:var(--muted);font-size:14px;border-top:1px solid var(--border)}
@media (max-width:860px){.hero{grid-template-columns:1fr;gap:32px}ol.how{grid-template-columns:1fr;gap:24px}.table-scroll{overflow-x:auto}}
@media (max-width:460px){.pair{gap:10px}figure{width:calc(50% - 5px)}.phone{border-radius:20px;padding:6px}.phone video{width:100%;border-radius:15px}}
`;

function head(title: string, description: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>`;
}

function nav(): string {
  return `<div class="wrap"><nav><a class="wordmark" href="/">AisleRun</a><div class="links"><a href="/demo">Demo runs</a><a href="/docs">API</a></div></nav></div>`;
}

function runFigure(run: DemoRun, caption: string): string {
  const video = run.mobileVideoUrl
    ? `<video src="${esc(run.mobileVideoUrl)}" autoplay muted loop playsinline preload="metadata" aria-label="Mobile recording of run ${esc(run.label)}"></video>`
    : `<video aria-label="Recording unavailable"></video>`;
  return `<figure><div class="phone">${video}</div><figcaption><span class="verdict ${esc(run.verdict ?? "")}">Mobile ${esc(run.viewports.find((v) => v.viewport === "mobile")?.verdict ?? run.status)}</span><br>${caption}<br><a href="${esc(run.reportUrl)}">Open report ${esc(run.label)}</a></figcaption></figure>`;
}

export function renderHomePage(config: Config, runs: DemoRun[]): string {
  const failed = runs.find((r) => r.role === "failed");
  const retest = runs.find((r) => r.role === "retest");
  const hero =
    failed && retest
      ? `<div class="pair">${runFigure(failed, "Seeded mobile defect. The cart stays at 0.")}${runFigure(retest, "Same journey after the fix, paid for again.")}</div>`
      : "";
  return `${head("AisleRun", "Checkout testing your AI agent can order: a paid, recorded shopper run to checkout on mobile and desktop.")}
${nav()}
<main>
<div class="wrap hero">
  <div>
    <h1>Checkout testing your AI agent can order.</h1>
    <p class="lede">Your agent pays for one real browser run through PayBox. AisleRun opens your product page on a phone and a desktop, adds to cart, reaches checkout, and hands back the recording and the first step that broke.</p>
    <div class="cta">${failed ? `<a class="btn primary" href="${esc(failed.reportUrl)}">View the failed run</a>` : ""}${retest ? `<a class="btn secondary" href="${esc(retest.reportUrl)}">See the paid retest</a>` : ""}</div>
  </div>
  ${hero}
</div>
<div class="wrap"><p class="note">Both recordings are real-time Playwright captures of runs paid through PayBox on Base. The store is AisleRun's own labelled test fixture with a deliberately seeded defect. No real merchant was affected.</p></div>
<div class="wrap"><section>
  <h2>How ordering works</h2>
  <ol class="how">
    <li><h3>Ask for a quote</h3><p>The agent names an authorized product page and gets a fixed price, scope and expiry. Nothing is charged and unapproved stores are refused here.</p></li>
    <li><h3>Pay through PayBox</h3><p>PayBox signs a ${esc(config.INSPECTION_PRICE_USD)} USDC x402 payment under your wallet's own approval rules. The browser only starts after the payment settles.</p></li>
    <li><h3>Get evidence</h3><p>Pass, fail or inconclusive for each screen size, with the recording, screenshots, a Playwright trace and the step where it stopped.</p></li>
  </ol>
</section>
<section>
  <h2>What it does not do</h2>
  <ul class="limits">
    <li>It never places an order, enters payment details or logs in.</li>
    <li>It only tests stores on its authorized list. Right now that is AisleRun's own synthetic fixtures.</li>
    <li>A pass means this journey reached checkout once, in Chromium. It does not prove every buyer can check out.</li>
    <li>Bot checks and unavailable products come back inconclusive, never as a store failure.</li>
  </ul>
</section></div>
</main>
<footer><div class="wrap">AisleRun is a hackathon build for MoonPay Chapter 1. Build ${esc(config.BUILD_VERSION)}. <a href="/docs">API docs</a></div></footer>
</body></html>`;
}

export function renderDemoPage(config: Config, runs: DemoRun[]): string {
  const roleText: Record<string, string> = {
    failed: "Before the fix",
    retest: "After the fix",
    control: "Healthy control",
    blocked: "Bot check",
  };
  const rows = runs
    .map(
      (r) => `<tr><td><a href="${esc(r.reportUrl)}">${esc(r.label)}</a><br><span class="tx">${esc(r.createdAt.replace("T", " ").slice(0, 19))}Z</span></td>
<td>${esc(roleText[r.role] ?? r.role)}<br><span class="tx">${esc(r.fixtureVersion ?? "")}</span></td>
<td>${r.viewports.map((v) => `<span class="verdict ${esc(v.verdict)}">${esc(v.viewport)} ${esc(v.verdict)}</span>${v.blocker ? ` <span class="tx">${esc(v.blocker)}</span>` : ""}`).join("<br>")}</td>
<td>${r.settlement ? `<a class="tx" href="https://basescan.org/tx/${esc(r.settlement)}" rel="noopener">${esc(r.settlement.slice(0, 10))}…${esc(r.settlement.slice(-6))}</a>` : "–"}</td></tr>`,
    )
    .join("");
  return `${head("AisleRun demo runs", "Published PayBox-paid AisleRun inspections of labelled synthetic fixtures.")}
${nav()}
<main class="wrap">
<h1 style="font-size:36px;max-width:none">Demo runs</h1>
<p class="lede">Each row is a separate inspection that a PayBox-connected agent paid for. Open a report to watch the recording and read the steps. Payment links go to the settlement transaction on Base.</p>
<p class="note">Every target here is a synthetic AisleRun fixture at ${esc(config.FIXTURE_ORIGIN)}. The broken version has a defect seeded on purpose, and the fixed version is that one-line repair.</p>
<div class="table-scroll"><table><thead><tr><th>Run</th><th>Fixture</th><th>Result</th><th>Settlement</th></tr></thead><tbody>${rows || `<tr><td colspan="4">No runs have been published yet.</td></tr>`}</tbody></table></div>
<section><h2>Run one yourself</h2><p class="lede" style="max-width:68ch">With your own PayBox wallet credential holding a little USDC on Base, ask your agent to call <code>use_service</code> on <code>${esc(config.SERVICE_BASE_URL)}/v1/inspections</code> after getting a quote. The exact steps are in the <a href="/docs">API docs</a>.</p></section>
</main>
<footer><div class="wrap">Build ${esc(config.BUILD_VERSION)}</div></footer>
</body></html>`;
}
