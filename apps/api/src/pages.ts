import type { Config } from "../../../packages/shared/src/config.js";

const BASE_STYLE = `
:root{--canvas:#F6F6F2;--panel:#FFFFFF;--ink:#191D1C;--muted:#676F6B;--border:#DCDFD9;--pos:#1E7352;--neg:#B33E35;--warn:#966413;--info:#2D5E86}
@media (prefers-color-scheme:dark){:root{--canvas:#121514;--panel:#1A1E1D;--ink:#ECEEEA;--muted:#9AA29E;--border:#2C3230;--pos:#4FB287;--neg:#E0766C;--warn:#D6A54A;--info:#7AA7D1}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--canvas);color:var(--ink);font:15px/1.5 Inter,system-ui,-apple-system,sans-serif}
a{color:var(--info)}code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
.wrap{max-width:1180px;margin:0 auto;padding:24px 16px 64px}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:12px}
.muted{color:var(--muted)}
`;

export function renderRunPage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>AisleRun run</title>
<style>${BASE_STYLE}
header.top{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:baseline;justify-content:space-between;margin-bottom:16px}
h1{font-size:24px;margin:0;font-weight:600}.sub{font-size:13px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}
.chip{display:inline-flex;gap:6px;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid var(--border);font-size:13px;font-weight:600}
.chip.PASS{color:var(--pos);border-color:var(--pos)}.chip.FAIL{color:var(--neg);border-color:var(--neg)}.chip.INCONCLUSIVE{color:var(--warn);border-color:var(--warn)}
.disclosure{margin:12px 0;padding:10px 14px;border-radius:10px;border:1px solid var(--warn);color:var(--warn);font-size:14px}
.blocker{margin:12px 0;padding:14px 16px;border-left:4px solid var(--neg)}.blocker h2{margin:0 0 4px;font-size:16px}
.grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px}
@media (max-width:860px){.grid{grid-template-columns:1fr}.timeline-col{order:-1}}
.media{padding:12px}.media video,.media img{width:100%;border-radius:8px;border:1px solid var(--border);background:#000}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:8px}
.shots a{display:block;font-size:11px;color:var(--muted);text-decoration:none}.shots img{aspect-ratio:3/4;object-fit:cover;object-position:top}
.tabs{display:flex;gap:8px;margin-bottom:8px}.tabs button{font:inherit;padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--ink);cursor:pointer}
.tabs button[aria-pressed=true]{border-color:var(--ink);font-weight:600}
.tabs button:focus-visible{outline:2px solid var(--info);outline-offset:2px}
ol.steps{list-style:none;margin:0;padding:0}
ol.steps li{padding:10px 14px;border-top:1px solid var(--border)}ol.steps li:first-child{border-top:0}
.res{font-weight:700;font-size:12px;letter-spacing:.02em}.res.PASS{color:var(--pos)}.res.FAIL{color:var(--neg)}.res.INCONCLUSIVE{color:var(--warn)}.res.SKIPPED{color:var(--muted)}
li.first-blocker{background:color-mix(in srgb,var(--neg) 8%,transparent)}
.live{padding:12px 14px;border-bottom:1px solid var(--border);font-size:14px}
.pulse{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--info);margin-right:6px;animation:p 1.2s ease-in-out infinite}
@keyframes p{50%{opacity:.25}}@media (prefers-reduced-motion:reduce){.pulse{animation:none}}
dl.facts{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:0;padding:14px;font-size:13px}dl.facts dt{color:var(--muted)}dl.facts dd{margin:0;word-break:break-all}
details{padding:0 14px 12px}summary{cursor:pointer;padding:10px 0;font-weight:600}
pre{white-space:pre-wrap;word-break:break-word;font-size:12px;margin:0}
.error{padding:20px}
</style></head>
<body><main class="wrap" id="app" aria-live="polite"><p class="muted">Loading run…</p></main>
<script>
(function(){
  var app = document.getElementById("app");
  var id = location.pathname.split("/").filter(Boolean).pop();
  var token = new URLSearchParams(location.hash.slice(1)).get("token");
  var headers = token ? { Authorization: "Bearer " + token } : {};
  var cursor = 0, events = [], activeViewport = null, lastStatus = null;
  var TERMINAL = ["PAYMENT_DENIED","COMPLETED","INCONCLUSIVE","FAILED_INTERNAL","CANCELLED"];
  var STATUS_TEXT = {
    AWAITING_SETTLEMENT: "Payment verified; waiting for settlement before any browser work.",
    QUEUED: "Job accepted. Waiting for the browser worker.",
    STARTING: "Launching Chromium.",
    RUNNING_MOBILE: "Running the mobile journey (390×844).",
    RUNNING_DESKTOP: "Running the desktop journey (1440×900).",
    UPLOADING_EVIDENCE: "Storing evidence. No verdict is shown until evidence is stored.",
    PAYMENT_DENIED: "Payment was not settled, so no browser work ran.",
    FAILED_INTERNAL: "AisleRun failed internally. This is a service failure, not a store defect.",
    CANCELLED: "The run was cancelled by the timeout policy."
  };

  function el(tag, attrs, children){
    var n = document.createElement(tag);
    for (var k in (attrs||{})) { if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (children||[]).forEach(function(c){ if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function fail(msg){ app.replaceChildren(el("div",{class:"panel error"},[el("h1",{text:"Report unavailable"}), el("p",{class:"muted",text:msg})])); }
  function get(path){
    return fetch(path, { headers: headers }).then(function(r){
      return r.json().then(function(j){ if (!r.ok) throw new Error(j.message || ("HTTP " + r.status)); return j; });
    });
  }
  function ts(s){ return s ? new Date(s).toISOString().replace("T"," ").slice(0,19) + "Z" : "–"; }
  function dur(a,b){ return a && b ? ((new Date(b) - new Date(a))/1000).toFixed(1) + " s" : "–"; }

  if (!id || !token) { fail("This link has no read token. Open the report_url returned by the paid request."); return; }

  function poll(){
    Promise.all([get("/v1/inspections/" + id), get("/v1/inspections/" + id + "/events?after=" + cursor)]).then(function(r){
      var ins = r[0], ev = r[1];
      events = events.concat(ev.events); cursor = ev.next_cursor;
      if (TERMINAL.indexOf(ins.status) >= 0) return get("/v1/reports/" + id).then(renderReport);
      renderLive(ins); setTimeout(poll, ins.poll_after_ms || 2000);
    }).catch(function(e){ fail(e.message); });
  }

  function causal(){
    var strip = events.filter(function(e){ return e.details && e.details.cause_effect; }).map(function(e){ return e.details.cause_effect; });
    return strip.length ? el("p",{class:"mono",text:strip[strip.length-1]}) : null;
  }

  function renderLive(ins){
    var last = events[events.length-1];
    var lines = events.slice(-12).reverse().map(function(e){
      var d = e.details || {};
      return el("li",{},[el("span",{class:"mono muted",text:ts(e.created_at).slice(11,19)+"  "}), el("strong",{text:e.type.replace(/_/g," ")}), " ", d.viewport ? "["+d.viewport+"] " : "", d.step ? d.step+" – " : "", d.observed || d.next_action || ""]);
    });
    app.replaceChildren(
      el("header",{class:"top"},[el("div",{},[el("h1",{text:"Run AR-" + id.slice(0,8).toUpperCase()}), el("div",{class:"sub muted mono",text:id})])]),
      el("div",{class:"panel"},[
        el("div",{class:"live",role:"status"},[el("span",{class:"pulse","aria-hidden":"true"}), el("strong",{text:ins.status.replace(/_/g," ")}), " – ", STATUS_TEXT[ins.status] || "", ins.elapsed_ms != null ? el("span",{class:"muted mono",text:"  elapsed " + (ins.elapsed_ms/1000).toFixed(1) + " s"}) : null]),
        causal() ? el("div",{class:"live"},[causal()]) : null,
        el("ol",{class:"steps",reversed:""},lines)
      ])
    );
    lastStatus = ins.status;
  }

  function renderReport(rep){
    if (!activeViewport) {
      var failed = rep.viewports.filter(function(v){ return v.verdict !== "PASS"; })[0];
      activeViewport = (failed || rep.viewports[0] || {}).viewport;
    }
    var chips = rep.viewports.map(function(v){ return el("span",{class:"chip " + v.verdict},[v.viewport + " " + v.size.width + "×" + v.size.height + ": " + v.verdict]); });
    var overall = rep.overall_verdict ? el("span",{class:"chip " + rep.overall_verdict},["Overall: " + rep.overall_verdict]) : el("span",{class:"chip"},[rep.status]);
    var blockerStep = null, blockerVp = null;
    rep.viewports.forEach(function(v){ v.steps.forEach(function(s){ if (s.is_first_blocker && !blockerStep) { blockerStep = s; blockerVp = v; } }); });

    var head = el("header",{class:"top"},[
      el("div",{},[el("h1",{text:"Run " + rep.run_label}), el("div",{class:"sub muted mono",text:rep.inspection_id + " · " + ts(rep.created_at)}), el("div",{class:"chips"},[overall].concat(chips))]),
      el("div",{class:"sub muted"},[rep.target ? el("span",{class:"mono",text:rep.target.product_url}) : null])
    ]);
    var parts = [head];
    if (rep.fixture_disclosure) parts.push(el("div",{class:"disclosure",role:"note",text:rep.fixture_disclosure}));
    if (STATUS_TEXT[rep.status] && rep.status !== "COMPLETED") parts.push(el("div",{class:"panel blocker"},[el("h2",{text:rep.status.replace(/_/g," ")}), el("p",{text:STATUS_TEXT[rep.status] + (rep.error_code ? " (" + rep.error_code + ")" : "")})]));
    if (blockerStep) parts.push(el("section",{class:"panel blocker","aria-label":"First confirmed blocker"},[
      el("h2",{text:"First blocker: " + (blockerVp.blocker || blockerStep.result) + " on " + blockerVp.viewport}),
      el("p",{},[el("strong",{text:"Observed: "}), blockerStep.decision]),
      el("p",{},[el("strong",{text:"Expected: "}), String(blockerStep.expected)]),
      blockerVp.attempts > 1 ? el("p",{class:"muted",text:"Reproduced in " + blockerVp.attempts + " clean browser contexts."}) : null,
      blockerVp.console_errors.length ? el("p",{class:"muted"},["Console evidence (raw, not a diagnosis): ", el("code",{text:blockerVp.console_errors[0]})]) : null
    ]));

    var vp = rep.viewports.filter(function(v){ return v.viewport === activeViewport; })[0];
    var tabs = el("div",{class:"tabs",role:"group","aria-label":"Viewport"}, rep.viewports.map(function(v){
      var b = el("button",{type:"button","aria-pressed":String(v.viewport===activeViewport),text:v.viewport + " · " + v.verdict});
      b.addEventListener("click", function(){ activeViewport = v.viewport; renderReport(rep); });
      return b;
    }));
    var media = el("section",{class:"panel media","aria-label":"Recording"},[tabs]);
    if (vp) {
      var videos = vp.artifacts.filter(function(a){ return a.kind === "video"; });
      var lastVideo = videos[videos.length-1];
      media.appendChild(lastVideo ? el("video",{src:lastVideo.url,controls:"",muted:"",playsinline:"",preload:"metadata","aria-label":lastVideo.label}) : el("p",{class:"muted",text:"No recording stored for this viewport."}));
      if (lastVideo) media.appendChild(el("p",{class:"muted sub",text:lastVideo.label + " · real-time Playwright capture, not sped up"}));
      media.appendChild(el("div",{class:"shots"}, vp.artifacts.filter(function(a){ return a.kind === "screenshot"; }).map(function(a){
        return el("a",{href:a.url,target:"_blank",rel:"noopener"},[el("img",{src:a.url,alt:a.label,loading:"lazy"}), a.label]);
      })));
      var trace = vp.artifacts.filter(function(a){ return a.kind === "trace"; });
      if (trace.length) media.appendChild(el("p",{class:"sub"},["Playwright trace: "].concat(trace.map(function(t,i){ return el("a",{href:t.url,text:(i?" · ":"") + t.label}); }))));
    }
    var steps = el("section",{class:"panel timeline-col","aria-label":"Step chronology"},[
      el("ol",{class:"steps"}, (vp ? vp.steps : []).map(function(s){
        return el("li",{class:s.is_first_blocker ? "first-blocker" : ""},[
          el("div",{},[el("span",{class:"res " + s.result,text:s.result}), "  ", el("strong",{text:s.ordinal + ". " + s.action.replace(/_/g," ")}), el("span",{class:"muted mono sub",text:"  " + ts(s.started_at).slice(11,19) + " · " + dur(s.started_at, s.ended_at)})]),
          el("div",{text:s.decision}),
          el("details",{},[el("summary",{text:"Observed data"}), el("pre",{text:JSON.stringify(s.observed, null, 2)})])
        ]);
      })),
      vp ? el("dl",{class:"facts"},[
        el("dt",{text:"Browser"}), el("dd",{class:"mono",text:vp.browser_version}),
        el("dt",{text:"Fixture build"}), el("dd",{class:"mono",text:vp.fixture_version || "not a fixture"}),
        el("dt",{text:"Attempts"}), el("dd",{text:String(vp.attempts)}),
        el("dt",{text:"Duration"}), el("dd",{class:"mono",text:dur(vp.started_at, vp.ended_at)}),
        el("dt",{text:"Blocked requests"}), el("dd",{text:String(vp.blocked_requests.length)})
      ]) : null
    ]);
    parts.push(el("div",{class:"grid"},[media, steps]));
    var pay = rep.payment;
    parts.push(el("section",{class:"panel",style:"margin-top:16px","aria-label":"Provenance"},[el("dl",{class:"facts"},[
      el("dt",{text:"Payment"}), el("dd",{class:"mono",text:pay ? pay.state + " · " + pay.network + " · " + (Number(pay.amount_atomic)/1e6).toFixed(2) + " USDC" : "–"}),
      el("dt",{text:"Settlement tx"}), el("dd",{},[pay && pay.settlement_reference ? el("a",{class:"mono",href:"https://basescan.org/tx/" + pay.settlement_reference,target:"_blank",rel:"noopener",text:pay.settlement_reference}) : "–"]),
      el("dt",{text:"Classifier"}), el("dd",{text:rep.classification_source}),
      el("dt",{text:"Limitations"}), el("dd",{text:rep.limitations.join(" ")}),
      el("dt",{text:"Build"}), el("dd",{class:"mono",text:rep.provenance.build}),
      el("dt",{text:"Machine-readable"}), el("dd",{class:"mono",text:"GET /v1/reports/" + rep.inspection_id})
    ])]));
    app.replaceChildren.apply(app, parts);
  }

  poll();
})();
</script></body></html>`;
}

export function renderDocsPage(config: Config): string {
  const base = config.SERVICE_BASE_URL;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AisleRun API</title><style>${BASE_STYLE} h1{font-size:26px}h2{font-size:18px;margin-top:28px}pre{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px;overflow-x:auto;font-size:13px}</style></head>
<body><main class="wrap" style="max-width:820px">
<h1>AisleRun API</h1>
<p>One paid synthetic shopper run on an operator-authorized storefront: product page → cart → checkout entrance, in mobile (390×844) and desktop (1440×900) Chromium. It never places an order or enters payment details.</p>
<h2>1. Quote (free)</h2>
<pre>POST ${base}/v1/quotes
{"product_url":"${config.FIXTURE_ORIGIN}/v/fixture-healthy-v1/products/cup","authorized_target_id":"fixture-healthy-v1","profile":"shopify_checkout_entry_v1","viewports":["mobile","desktop"]}</pre>
<p>Unauthorized targets are refused here with <code>TARGET_NOT_AUTHORIZED</code>, before any payment. Quotes expire after 15 minutes. Price: ${config.INSPECTION_PRICE_USD} USDC on Base (${config.X402_NETWORK}), x402 v2 <code>exact</code>.</p>
<h2>2. Pay and start (x402)</h2>
<pre>POST ${base}/v1/inspections
{"quote_id":"…","product_url":"…","authorized_target_id":"…","profile":"shopify_checkout_entry_v1","idempotency_key":"&lt;stable uuid&gt;"}</pre>
<p>Without payment this returns HTTP 402 with a <code>PAYMENT-REQUIRED</code> header. With PayBox:</p>
<pre>paybox use-service --credential &lt;wallet id&gt; --method POST --url ${base}/v1/inspections --body '{…}'</pre>
<p>or the MCP tool <code>use_service</code> with <code>method: "POST"</code> and the same <code>body</code>. The paid response body (PayBox returns the body, not headers) contains <code>inspection_id</code>, <code>result_url</code>, <code>read_token</code> and <code>report_url</code>. The browser job is queued only after the payment settles on-chain. Retrying the same quote with the same idempotency key returns the original job without charging again.</p>
<h2>3. Read results (free, token-scoped)</h2>
<pre>GET ${base}/v1/inspections/{id}          Authorization: Bearer &lt;read_token&gt;
GET ${base}/v1/inspections/{id}/events?after=&lt;cursor&gt;
GET ${base}/v1/reports/{id}</pre>
<p>Verdicts: <code>PASS</code>, <code>FAIL</code> (reproduced twice in clean contexts), <code>INCONCLUSIVE</code> (bot check, out of stock, unsupported markup). Infrastructure errors are <code>FAILED_INTERNAL</code> and never count as a store defect.</p>
<h2>Authorized targets</h2>
<p>During the hackathon only the labelled synthetic fixtures at <a href="${config.FIXTURE_ORIGIN}">${config.FIXTURE_ORIGIN}</a> are authorized. A public URL is not treated as permission to test a store.</p>
</main></body></html>`;
}
