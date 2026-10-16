import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import type { Config } from "../../../packages/shared/src/config.js";
import type { Report } from "../../api/src/report.js";

const STATIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "static");

export const PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self'",
  "media-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export interface DemoEntry {
  role: string;
  report: Report;
}

export interface WebDeps {
  config: Config;
  loadDemoReports: () => Promise<DemoEntry[]>;
}

const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const MARK = `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 15h3.2l2.3-8h4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="7" r="1.6" fill="currentColor"/></svg>`;

function layout(opts: { title: string; description: string; current?: string; body: string; scripts?: string[]; build: string }): string {
  const nav = (href: string, label: string, extra = "") =>
    `<a href="${href}"${opts.current === href ? ' aria-current="page"' : ""}${extra}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<meta name="referrer" content="no-referrer">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/app.css?v=${esc(opts.build)}">
<link rel="stylesheet" href="/assets/pages.css?v=${esc(opts.build)}">
${(opts.scripts ?? []).map((s) => `<script type="module" src="/assets/${s}?v=${esc(opts.build)}"></script>`).join("\n")}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="container">
  <a class="wordmark" href="/">${MARK}<span>aislerun</span></a>
  <nav class="site-nav" aria-label="Main">${nav("/#how", "How it works", ' class="optional"')}${nav("/demo", "Demo")}${nav("/docs", "Docs", ' class="optional"')}</nav>
</div></header>
${opts.body}
<footer class="site-footer"><div class="container">
  <span>AisleRun runs synthetic shopper journeys up to checkout entry. It never places orders. Build <span class="mono">${esc(opts.build)}</span>.</span>
  <nav aria-label="Footer"><a href="/demo">Demo</a><a href="/docs">Docs</a><a href="/docs#limits">Limitations</a></nav>
</div></footer>
</body>
</html>`;
}

const statusChip = (verdict: string | null | undefined, label?: string) => {
  const v = verdict ?? "SERVICE";
  const cls = ["PASS", "FAIL", "INCONCLUSIVE"].includes(v) ? v : "SERVICE";
  return `<span class="status status-${cls}">${esc(label ?? v)}</span>`;
};

const shortTx = (tx: string | null | undefined) => (tx ? `${tx.slice(0, 10)}…${tx.slice(-6)}` : "–");
const txLink = (tx: string | null | undefined) =>
  tx ? `<a class="mono" href="https://basescan.org/tx/${esc(tx)}" target="_blank" rel="noopener noreferrer">${esc(shortTx(tx))}</a>` : "–";
const utc = (d: Date | string | null | undefined) => (d ? `${new Date(d).toISOString().replace("T", " ").slice(0, 16)} UTC` : "–");
const seconds = (ms: number | null | undefined) => (ms == null ? "–" : `${(ms / 1000).toFixed(1)} s`);
const vp = (r: Report, name: string) => r.viewports.find((v) => v.viewport === name);

const STEP_LABEL: Record<string, string> = {
  load: "Product page loaded",
  ready: "Product and price found",
  variant: "Variant selected",
  add_to_cart: "Add to cart clicked",
  confirm_cart: "Cart unchanged",
  checkout_entry: "Checkout entry",
};

export function renderHome(config: Config, demo: DemoEntry[]): string {
  const failed = demo.find((d) => d.role === "failed")?.report;
  const retest = demo.find((d) => d.role === "retest")?.report;
  const control = demo.find((d) => d.role === "control")?.report;
  const mobile = failed ? vp(failed, "mobile") : undefined;

  const strip = mobile
    ? mobile.steps
        .filter((s) => s.video_offset_ms != null)
        .map((s) => {
          const label = s.action === "confirm_cart" && s.result === "PASS" ? "Cart confirmed" : (STEP_LABEL[s.action] ?? s.action);
          return `<li data-offset-ms="${s.video_offset_ms}" data-result="${esc(s.result)}"><span class="dot" aria-hidden="true"></span><span>${esc(label)}<small class="mono">≈${((s.video_offset_ms ?? 0) / 1000).toFixed(1)} s · ${esc(s.result)}</small></span></li>`;
        })
        .join("")
    : "";

  const replay =
    failed && mobile?.recording
      ? `<figure class="panel replay" data-replay style="margin:0">
  <div class="replay-head"><span class="fixture-badge">Real recorded demo · controlled fixture</span><span class="small muted mono">${esc(failed.run_label)}</span></div>
  <div class="replay-body">
    <div class="viewer-stage"><video src="${esc(mobile.recording.url)}" ${mobile.recording.poster_url ? `poster="${esc(mobile.recording.poster_url)}"` : ""} autoplay muted loop playsinline controls preload="auto" aria-label="Real mobile recording of run ${esc(failed.run_label)}, attempt ${mobile.recording.attempt} of ${mobile.attempts}"></video></div>
    <div>
      <ol class="step-strip" aria-label="Steps in this recording">${strip}<li data-offset-ms="${Number.MAX_SAFE_INTEGER}" data-result="INFO" class="is-done"><span class="dot" aria-hidden="true"></span><span>Failure reproduced<small>Attempt ${mobile.attempts} of ${mobile.attempts} in a clean browser</small></span></li></ol>
    </div>
  </div>
  <figcaption class="replay-foot"><span>Mobile 390×844, real time, attempt ${mobile.recording.attempt}. Paid through PayBox.</span><a href="/demo/runs/${esc(failed.inspection_id)}">Open detailed report</a></figcaption>
</figure>`
      : `<div class="panel panel-pad"><p class="muted">No published recording yet. See <a href="/demo">demo runs</a>.</p></div>`;

  const proofCard = (r: Report | undefined, title: string, note: string, href: string) =>
    r
      ? `<article class="panel"><h3>${esc(title)}</h3><p class="small muted" style="margin:0">${esc(note)}</p>
<div class="verdicts">${r.viewports.map((v) => statusChip(v.verdict, `${v.viewport} ${v.verdict}`)).join("")}</div>
<dl><dt>Run</dt><dd class="mono">${esc(r.run_label)}</dd><dt>Fixture</dt><dd class="mono">${esc(r.fixture_version)}</dd><dt>Settlement</dt><dd>${txLink(r.payment?.settlement_reference)}</dd></dl>
<a class="open text-link" href="${esc(href)}">Open report</a></article>`
      : "";

  const body = `<main id="main">
<div class="container hero">
  <div>
    <span class="micro">Shopper testing for AI agents</span>
    <h1>Your store can load. Buying can still break.</h1>
    <p class="lede">AisleRun runs a real mobile and desktop shopping journey, records the first checkout blocker, and gives your agent evidence to verify the fix.</p>
    <div class="cta-row">
      ${failed ? `<a class="btn btn-primary" href="/demo/runs/${esc(failed.inspection_id)}">Watch a real inspection</a>` : `<a class="btn btn-primary" href="/demo">Watch a real inspection</a>`}
      <a class="text-link" href="#how">How PayBox works</a>
    </div>
    <p class="assurances">Pay-per-run via PayBox · Stops before purchase · Authorized test stores only</p>
  </div>
  ${replay}
</div>

<div class="container"><section class="band" id="how" aria-labelledby="how-title">
  <h2 id="how-title">How an agent orders a run</h2>
  <ol class="steps3">
    <li><h3>Agent commissions</h3><p>Your agent asks for a free quote on an authorized product page. Unapproved stores are refused here, before any charge.</p></li>
    <li><h3>PayBox pays</h3><p>PayBox signs a ${esc(config.INSPECTION_PRICE_USD)} USDC x402 payment on Base under your wallet's own limits. The payment buys the run; it is not the test.</p></li>
    <li><h3>Evidence returns</h3><p>After the payment settles, Chromium runs the journey on a phone and a desktop viewport and returns verdicts, recordings and the first blocking step.</p></li>
  </ol>
</section>

<section class="band" aria-labelledby="proof-title">
  <h2 id="proof-title">Three paid runs on our test store</h2>
  <div class="proof">
    ${proofCard(failed, "Broken", "Mobile Add to cart fails; desktop works.", failed ? `/demo/runs/${failed.inspection_id}` : "/demo")}
    ${proofCard(retest, "After the repair", "Same product, one-line fix, paid for again.", retest ? `/demo/runs/${retest.inspection_id}` : "/demo")}
    ${proofCard(control, "Healthy control", "A store with no seeded defect passes.", control ? `/demo/runs/${control.inspection_id}` : "/demo")}
  </div>
  ${failed && retest ? `<p style="margin:20px 0 0"><a class="btn btn-quiet" href="/demo/compare">Open the before and after comparison</a></p>` : ""}
</section>

<section class="band scope two-col" aria-label="Scope">
  <div><h3>What it checks</h3><ul><li>The product page loads and shows a price</li><li>Add to cart changes the cart, confirmed by two signals</li><li>The cart leads to the checkout entrance</li><li>Each of the above at 390×844 and 1440×900</li></ul></div>
  <div><h3>What it doesn't</h3><ul><li>Payment, shipping forms or placing an order</li><li>Stores that aren't on the authorized list</li><li>Getting past bot checks. Those come back inconclusive, not failed</li><li>Proving every buyer can check out</li></ul></div>
</section></div>
</main>`;
  return layout({ title: "AisleRun: checkout testing your AI agent can order", description: "A paid, recorded shopper run to checkout entry on mobile and desktop, ordered by an AI agent through PayBox.", current: "/", body, scripts: ["replay.js"], build: config.BUILD_VERSION });
}

export function renderDemo(config: Config, demo: DemoEntry[]): string {
  const card = (entry: DemoEntry | undefined, title: string, extraClass = "") => {
    if (!entry) return "";
    const r = entry.report;
    const m = vp(r, "mobile");
    const poster = m?.recording?.poster_url ?? m?.artifacts.find((a) => a.kind === "screenshot")?.url;
    return `<article class="panel run-card ${extraClass}">
  <div class="thumb">${poster ? `<img src="${esc(poster)}" alt="Mobile screenshot from run ${esc(r.run_label)}" loading="lazy">` : ""}</div>
  <div>
    <span class="micro">${esc(r.fixture_version)}</span>
    <h2>${esc(title)}</h2>
    <div class="verdicts">${r.viewports.map((v) => statusChip(v.verdict, `${v.viewport} ${v.verdict}${v.blocker ? ` · ${v.blocker}` : ""}`)).join("")}</div>
    <dl>
      <dt>Run</dt><dd class="mono">${esc(r.inspection_id)}</dd>
      <dt>Paid</dt><dd class="mono">${esc(utc(r.created_at))}</dd>
      <dt>Duration</dt><dd class="mono">${esc(seconds(r.duration_ms))}</dd>
      <dt>Settlement</dt><dd>${txLink(r.payment?.settlement_reference)}</dd>
    </dl>
    <div class="links"><a class="btn btn-quiet btn-sm" href="/demo/runs/${esc(r.inspection_id)}">Open report</a></div>
  </div>
</article>`;
  };
  const failed = demo.find((d) => d.role === "failed");
  const retest = demo.find((d) => d.role === "retest");
  const control = demo.find((d) => d.role === "control");
  const blocked = demo.find((d) => d.role === "blocked");
  const body = `<main id="main" class="container">
<div class="demo-head">
  <span class="fixture-badge">Controlled test storefront</span>
  <h1 style="margin-top:14px">Real paid runs. One broken step. One verified repair.</h1>
  <p>Captured on a controlled test storefront and paid through PayBox. No real purchase was placed.</p>
  ${failed && retest ? `<a class="btn btn-primary" href="/demo/compare">Compare broken vs repaired</a>` : ""}
</div>
${demo.length === 0 ? `<div class="empty-state"><h2>No runs are published yet</h2><p>Published runs appear here once the operator selects them.</p></div>` : ""}
<div class="sequence">${card(failed, "Broken: mobile failed, desktop passed")}${card(retest, "After repair: both passed")}</div>
<div class="sequence">${card(control, "Healthy control: both passed")}${card(blocked, "Bot check: inconclusive, not failed")}</div>
<p class="small muted" style="margin-top:20px;max-width:72ch">Every target here is a synthetic AisleRun fixture at <a href="${esc(config.FIXTURE_ORIGIN)}">${esc(config.FIXTURE_ORIGIN)}</a>. The broken version has a defect seeded on purpose and the repaired version is that one-line fix. Settlement links open the payment on Base; a payment shows the run was bought, not that the store passed.</p>
</main>`;
  return layout({ title: "Demo runs · AisleRun", description: "Three PayBox-paid AisleRun inspections of a controlled test storefront: broken, repaired and healthy.", current: "/demo", body, build: config.BUILD_VERSION });
}

export function renderRunShell(config: Config, opts: { id: string; source: "demo" | "private"; compareHref?: string }): string {
  return layout({
    title: "Shopper run · AisleRun",
    description: "AisleRun inspection report.",
    body: `<main id="main" class="container"><div id="app" data-page="run" data-source="${opts.source}" data-id="${esc(opts.id)}"${opts.compareHref ? ` data-compare="${esc(opts.compareHref)}"` : ""} aria-live="polite"><p class="muted" style="padding:48px 0">Loading run…</p></div></main>`,
    scripts: ["console.js"],
    build: config.BUILD_VERSION,
  });
}

export function renderCompareShell(config: Config, opts: { source: "demo" | "private"; before?: string; after?: string }): string {
  return layout({
    title: "Before and after · AisleRun",
    description: "Two independent PayBox-paid AisleRun inspections, before and after a repair.",
    body: `<main id="main" class="container"><div id="app" data-page="compare" data-source="${opts.source}"${opts.before ? ` data-before="${esc(opts.before)}" data-after="${esc(opts.after)}"` : ""} aria-live="polite"><p class="muted" style="padding:48px 0">Loading comparison…</p></div></main>`,
    scripts: ["console.js"],
    build: config.BUILD_VERSION,
  });
}

export function renderDocs(config: Config): string {
  const base = esc(config.SERVICE_BASE_URL);
  const fixture = esc(config.FIXTURE_ORIGIN);
  const body = `<main id="main" class="container docs">
<nav aria-label="On this page"><a href="#scope">What it tests</a><a href="#quote">1. Quote</a><a href="#pay">2. Pay with PayBox</a><a href="#read">3. Read results</a><a href="#verdicts">Verdicts</a><a href="#errors">Errors</a><a href="#paybox">What PayBox proves</a><a href="#limits">Limitations</a></nav>
<article>
<h1>AisleRun API</h1>
<p>One paid synthetic shopper run on an authorized storefront: product page, cart, checkout entrance, in mobile (390×844) and desktop (1440×900) Chromium. It never places an order or enters payment details.</p>

<h2 id="scope">What it tests and who is authorized</h2>
<p>Only targets on the operator's allowlist can be inspected. During the hackathon that is AisleRun's own labelled fixtures at <a href="${fixture}">${fixture}</a>: <span class="mono">fixture-healthy-v1</span>, <span class="mono">fixture-mobile-cart-broken-v1</span>, <span class="mono">fixture-fixed-v2</span> and <span class="mono">fixture-bot-check-v1</span>. A public URL is not treated as permission to test a store. <span class="mono">GET ${base}/v1/meta</span> lists the current targets and price.</p>

<h2 id="quote">1. Quote (free)</h2>
<pre>POST ${base}/v1/quotes
Content-Type: application/json

{"product_url":"${fixture}/v/fixture-fixed-v2/products/cup",
 "authorized_target_id":"fixture-fixed-v2",
 "profile":"shopify_checkout_entry_v1",
 "viewports":["mobile","desktop"]}</pre>
<p>Returns <span class="mono">quote_id</span>, <span class="mono">expires_at</span> (15 minutes), price (${esc(config.INSPECTION_PRICE_USD)} USDC, <span class="mono">${esc(config.X402_NETWORK)}</span>) and a <span class="mono">pay_with.body_template</span>. Unauthorized targets get <span class="mono">403 TARGET_NOT_AUTHORIZED</span> here, before any payment.</p>

<h2 id="pay">2. Pay and start with PayBox</h2>
<p>The paid route is an x402 v2 resource. Without payment it answers <span class="mono">402</span> with a <span class="mono">PAYMENT-REQUIRED</span> header (scheme <span class="mono">exact</span>, USDC on Base). From a PayBox-connected agent, call the MCP tool <span class="mono">use_service</span>:</p>
<pre>use_service({
  credential_id: "&lt;your PayBox wallet credential&gt;",
  url: "${base}/v1/inspections",
  method: "POST",
  body: {"quote_id":"…","product_url":"…","authorized_target_id":"…",
         "profile":"shopify_checkout_entry_v1","idempotency_key":"&lt;stable uuid&gt;"}
})</pre>
<p>Or the PayBox CLI: <span class="mono">paybox use-service --credential &lt;id&gt; --method POST --url ${base}/v1/inspections --body @body.json</span>. PayBox returns the response body to the agent (not headers), so everything is in the body:</p>
<pre>{"ok":true,"inspection_id":"f3f13c4c-…","status":"AWAITING_SETTLEMENT",
 "result_url":"${base}/v1/inspections/f3f13c4c-…",
 "read_token":"rt_…","report_url":"${base}/runs/f3f13c4c-…#token=…",
 "poll_after_ms":2000,"payment":{"state":"VERIFIED","reference":null}}</pre>
<p>The status says <span class="mono">AWAITING_SETTLEMENT</span> because the body is written before the payment settles. The browser starts only after settlement; in our runs that took about one second. Sending the same body again (same quote and idempotency key) returns the same job without a new charge. A different key on a used quote gets <span class="mono">409 IDEMPOTENCY_CONFLICT</span>.</p>

<h2 id="read">3. Read results (free, token-scoped)</h2>
<pre>GET ${base}/v1/inspections/{id}          Authorization: Bearer &lt;read_token&gt;
GET ${base}/v1/inspections/{id}/events?after=&lt;cursor&gt;
GET ${base}/v1/reports/{id}</pre>
<p>Poll every 2 seconds until <span class="mono">terminal</span> is true. Our paid runs finished 7 to 19 seconds after settlement. Evidence URLs in a report are signed and expire after 30 minutes.</p>

<h2 id="verdicts">Verdicts</h2>
<table><thead><tr><th>Verdict</th><th>Meaning</th></tr></thead><tbody>
<tr><td>${statusChip("PASS")}</td><td>The item reached the cart (count and line item both changed) and the checkout entrance opened.</td></tr>
<tr><td>${statusChip("FAIL")}</td><td>A material blocker reproduced in two clean browser contexts, for example <span class="mono">ADD_TO_CART_NO_EFFECT</span> or <span class="mono">CHECKOUT_ENTRY_BLOCKED</span>.</td></tr>
<tr><td>${statusChip("INCONCLUSIVE")}</td><td>The journey could not be judged: bot check, product unavailable, unrecognised controls.</td></tr>
<tr><td>${statusChip("SERVICE", "Service error")}</td><td><span class="mono">FAILED_INTERNAL</span> or <span class="mono">CANCELLED</span>: AisleRun's own failure. Never counted as a store defect. A crashed run is retried once on the same payment.</td></tr>
</tbody></table>

<h2 id="errors">Errors</h2>
<p>Errors are <span class="mono">{ok:false, code, message, retryable, request_id}</span>. Codes: <span class="mono">INVALID_INPUT, TARGET_NOT_AUTHORIZED, QUOTE_EXPIRED, QUOTE_SCOPE_MISMATCH, PAYMENT_UNVERIFIED, IDEMPOTENCY_CONFLICT, JOB_NOT_FOUND, REPORT_ACCESS_DENIED, RATE_LIMITED, INTERNAL_FAILURE</span>. Refusals that can be decided before payment (target, quote, queue full) never issue a payment challenge.</p>

<h2 id="paybox">What PayBox proves</h2>
<p>PayBox holds the wallet and enforces your approval mode and limits; AisleRun never sees a key. A settled payment proves the inspection was bought by that wallet. It says nothing about whether the store passed. AisleRun is reachable through <span class="mono">use_service</span> by URL; it is not listed in the PayBox marketplace and does not appear in <span class="mono">discover_services</span>.</p>

<h2 id="limits">Limitations</h2>
<ul>
<li>Checkout entry only. No order, payment details or login.</li>
<li>Chromium only, two viewport presets, one product journey profile.</li>
<li>A pass shows this journey worked once; it does not prove every buyer can check out.</li>
<li>Payments for runs that later fail internally are recorded but not refunded automatically.</li>
<li>Evidence is kept privately and deleted manually; demo runs are published deliberately.</li>
</ul>
</article>
</main>`;
  return layout({ title: "API docs · AisleRun", description: "How an agent quotes, pays through PayBox and reads AisleRun inspection results.", current: "/docs", body, build: config.BUILD_VERSION });
}

export function renderNotFound(build = "dev"): string {
  return layout({
    title: "Not found · AisleRun",
    description: "Page not found.",
    body: `<main id="main" class="container"><div class="empty-state"><h1>This page doesn't exist</h1><p>The run may have been removed or the link is mistyped.</p><p><a class="btn btn-quiet" href="/demo">Go to demo runs</a></p></div></main>`,
    build,
  });
}

export function registerWebRoutes(app: Express, deps: WebDeps): void {
  const { config } = deps;
  app.use("/assets", express.static(STATIC_DIR, { maxAge: "1h", index: false, extensions: [], dotfiles: "deny" }));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/v1/") && !req.path.startsWith("/assets/")) res.setHeader("Content-Security-Policy", PAGE_CSP);
    next();
  });

  app.get("/", async (_req, res) => {
    res.type("html").send(renderHome(config, await deps.loadDemoReports()));
  });
  app.get("/demo", async (_req, res) => {
    res.type("html").send(renderDemo(config, await deps.loadDemoReports()));
  });
  app.get("/demo/compare", (_req, res) => {
    res.type("html").send(renderCompareShell(config, { source: "demo" }));
  });
  app.get("/demo/runs/:id", async (req, res) => {
    const demo = await deps.loadDemoReports();
    const entry = demo.find((d) => d.report.inspection_id === req.params.id);
    if (!entry) {
      res.status(404).type("html").send(renderNotFound(config.BUILD_VERSION));
      return;
    }
    const paired = entry.role === "failed" || entry.role === "retest";
    const hasPair = demo.some((d) => d.role === "failed") && demo.some((d) => d.role === "retest");
    res.type("html").send(renderRunShell(config, { id: entry.report.inspection_id, source: "demo", compareHref: paired && hasPair ? "/demo/compare" : undefined }));
  });
  app.get("/runs/:id", (req, res) => {
    res.type("html").send(renderRunShell(config, { id: String(req.params.id), source: "private" }));
  });
  app.get("/runs/:id/compare/:otherId", (req, res) => {
    res.type("html").send(renderCompareShell(config, { source: "private", before: String(req.params.id), after: String(req.params.otherId) }));
  });
  app.get("/docs", (_req, res) => {
    res.type("html").send(renderDocs(config));
  });
}
