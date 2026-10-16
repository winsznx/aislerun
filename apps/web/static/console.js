import {
  actionText,
  blockerText,
  formatDuration,
  formatOffset,
  formatUtc,
  isTerminal,
  statusClass,
  statusInfo,
  summaryText,
  usdc,
  viewportSummary,
} from "./status.js";

const POLL_MS = 2000;

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const status = (result, label) => h("span", { class: `status ${statusClass(result)}` }, label ?? result);

async function getJson(url, headers) {
  let response;
  try {
    response = await fetch(url, { headers, cache: "no-store" });
  } catch {
    throw Object.assign(new Error("Connection interrupted."), { kind: "network" });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.message ?? `HTTP ${response.status}`), { kind: "http", status: response.status, code: body.code });
  return body;
}

function errorView(root, error, context) {
  const expired = error.status === 401 || error.status === 403;
  const missing = error.status === 404;
  const title = expired ? "This report link is not valid" : missing ? "Run not found" : "Could not load this run";
  const body = expired
    ? "The read token is missing, wrong or no longer accepted. Open the report_url returned by the paid request, or use a published demo run. AisleRun never makes private reports public to work around this."
    : missing
      ? "There is no run with this ID that you can view."
      : `${error.message} ${context ?? ""}`;
  root.replaceChildren(
    h("div", { class: "empty-state" },
      h("h1", { text: title }),
      h("p", { text: body }),
      h("p", {}, h("a", { class: "btn btn-quiet", href: "/demo" }, "Go to demo runs")),
    ),
  );
}

/* ---------- Player ---------- */

function createPlayer(viewports, { onViewportChange } = {}) {
  let active = viewports.find((v) => v.verdict !== "PASS") ?? viewports[0];
  let speed = 1;
  const stage = h("div", { class: "viewer-stage" });
  const caption = h("p", { class: "caption", "aria-live": "polite" });
  const tabs = h("div", { class: "segmented", role: "group", "aria-label": "Viewport" });
  const shots = h("div", { class: "shots", role: "group", "aria-label": "Screenshots" });
  const speedGroup = h("div", { class: "speed", role: "group", "aria-label": "Playback speed" });
  const expand = h("button", { class: "btn btn-quiet btn-sm", type: "button", onclick: () => current()?.requestFullscreen?.() }, "Expand video");
  const positions = new Map();

  const current = () => stage.querySelector("video");

  for (const rate of [1, 1.5, 2]) {
    speedGroup.append(h("button", { type: "button", "aria-pressed": String(rate === speed), onclick: (e) => {
      speed = rate;
      const v = current();
      if (v) v.playbackRate = rate;
      for (const b of speedGroup.children) b.setAttribute("aria-pressed", String(b === e.currentTarget));
    } }, `${rate}×`));
  }

  function showVideo(vp) {
    const rec = vp.recording;
    if (!rec) {
      stage.replaceChildren(h("p", { class: "stage-empty" }, "No recording was stored for this viewport. Screenshots below are the available evidence."));
      expand.hidden = true;
      return;
    }
    const video = h("video", {
      src: rec.url,
      poster: rec.poster_url ?? undefined,
      controls: true,
      muted: true,
      playsinline: true,
      preload: "metadata",
      "aria-label": `${vp.viewport} recording, attempt ${rec.attempt}`,
    });
    video.playbackRate = speed;
    video.addEventListener("loadedmetadata", () => {
      const saved = positions.get(vp.viewport);
      if (saved) video.currentTime = Math.min(saved, video.duration || saved);
      video.playbackRate = speed;
    });
    video.addEventListener("timeupdate", () => positions.set(vp.viewport, video.currentTime));
    video.addEventListener("error", () => {
      stage.replaceChildren(h("p", { class: "stage-empty" }, "The recording could not be played. Evidence links expire after 30 minutes; reload the page to get fresh ones."));
    });
    stage.replaceChildren(video, h("span", { class: "stage-label" }, `${vp.viewport} · ${vp.size.width}×${vp.size.height}`));
    expand.hidden = false;
  }

  function showShot(vp, artifact) {
    stage.replaceChildren(h("img", { src: artifact.url, alt: artifact.label }), h("span", { class: "stage-label" }, artifact.label));
    for (const b of shots.children) b.setAttribute("aria-pressed", String(b.dataset.id === artifact.id));
    expand.hidden = true;
    caption.textContent = `Screenshot: ${artifact.label}.`;
  }

  function render() {
    tabs.replaceChildren(...viewports.map((vp) => h("button", {
      type: "button",
      "aria-pressed": String(vp === active),
      onclick: () => select(vp.viewport),
    }, `${vp.viewport[0].toUpperCase()}${vp.viewport.slice(1)}`, status(vp.verdict))));
    showVideo(active);
    const rec = active.recording;
    caption.textContent = rec
      ? `Attempt ${rec.attempt} of ${active.attempts}. Real-time Playwright recording, not sped up.`
      : "";
    shots.replaceChildren(...active.artifacts.filter((a) => a.kind === "screenshot").map((a) =>
      h("button", { type: "button", "data-id": a.id, "aria-pressed": "false", onclick: () => showShot(active, a) },
        h("img", { src: a.url, alt: "", loading: "lazy" }), h("span", { text: a.label.replace(`${active.viewport} `, "") })),
    ));
  }

  function select(name) {
    const v = current();
    if (v) positions.set(active.viewport, v.currentTime);
    active = viewports.find((vp) => vp.viewport === name) ?? active;
    render();
    onViewportChange?.(active);
  }

  function seek(name, offsetMs) {
    if (active.viewport !== name) select(name);
    else showVideo(active);
    const video = current();
    if (!video || offsetMs == null) return;
    const go = () => {
      video.currentTime = Math.min(offsetMs / 1000, Math.max((video.duration || 0) - 0.1, 0));
      video.focus({ preventScroll: true });
    };
    if (video.readyState >= 1) go();
    else video.addEventListener("loadedmetadata", go, { once: true });
  }

  render();
  const element = h("section", { class: "viewer", "aria-label": "Recording" },
    h("div", { class: "viewer-bar" }, tabs, h("div", { class: "speed" }, speedGroup, expand)),
    stage,
    caption,
    shots,
  );
  return { element, seek, select, active: () => active };
}

/* ---------- Report ---------- */

function firstBlocker(report) {
  for (const vp of report.viewports) {
    const step = vp.steps.find((s) => s.is_first_blocker);
    if (step) return { vp, step };
  }
  return null;
}

function verdictBar(report) {
  const cells = report.viewports.map((vp) => h("div", { class: "verdict-cell" },
    h("span", { class: "micro" }, `${vp.viewport} ${vp.size.width}×${vp.size.height}`),
    status(vp.verdict),
    h("p", {}, viewportSummary(vp), vp.blocker ? h("span", { class: "mono muted blocker-code" }, vp.blocker) : null),
  ));
  const pay = report.payment;
  cells.push(h("div", { class: "verdict-cell" },
    h("span", { class: "micro" }, "Payment"),
    pay?.state === "SETTLED" ? status("PAID", "Settled via PayBox") : status("SERVICE", pay?.state ?? "Unknown"),
    h("p", {}, pay ? `${usdc(pay.amount_atomic)} on Base · ` : "",
      pay?.settlement_reference ? h("a", { class: "mono", href: `https://basescan.org/tx/${pay.settlement_reference}`, target: "_blank", rel: "noopener noreferrer" }, `${pay.settlement_reference.slice(0, 10)}…${pay.settlement_reference.slice(-6)}`) : "no settlement"),
  ));
  return h("div", { class: "verdict-bar", role: "group", "aria-label": "Outcome" }, cells);
}

function blockerCard(report) {
  const found = firstBlocker(report);
  if (!found) {
    const pass = report.overall_verdict === "PASS";
    return h("section", { class: `panel blocker-card ${pass ? "is-pass" : "is-inconclusive"}`, "aria-label": "Finding" },
      h("h2", {}, pass ? "No blocker. Both viewports reached checkout entry." : "No step could be judged."),
      h("p", { class: "muted small" }, pass ? "Checkout entry is where the journey stops. No order or payment details were submitted." : "See the timeline for what the browser observed."),
    );
  }
  const { vp, step } = found;
  const inconclusive = step.result === "INCONCLUSIVE";
  const consoleError = vp.console_errors?.[0];
  return h("section", { class: `panel blocker-card ${inconclusive ? "is-inconclusive" : ""}`, "aria-label": "First blocker" },
    h("span", { class: "micro" }, inconclusive ? "Could not judge" : "First confirmed blocker"),
    h("h2", {}, `${vp.viewport[0].toUpperCase()}${vp.viewport.slice(1)}: ${blockerText(vp.blocker) ?? step.result}`),
    h("dl", { class: "obs-exp" },
      h("div", {}, h("dt", {}, "Observed"), h("dd", {}, step.decision)),
      h("div", {}, h("dt", {}, "Expected"), h("dd", {}, String(step.expected))),
    ),
    vp.attempts > 1 ? h("p", { class: "possible-cause" }, `Reproduced in ${vp.attempts} separate clean browser contexts.`) : null,
    consoleError ? h("p", { class: "possible-cause" }, "Possible cause (raw console output, not a diagnosis): ", h("code", {}, consoleError.replace(/^\[[^\]]+\]\s*/, ""))) : null,
  );
}

function timeline(report, player) {
  const items = [];
  for (const vp of report.viewports) {
    for (const s of vp.steps) {
      items.push({ vp, s });
    }
    if (vp.retry) items.splice(items.findIndex((i) => i.vp === vp), 0, { vp, retry: vp.retry });
  }
  const list = h("ol", { class: "timeline" });
  for (const item of items) {
    if (item.retry) {
      list.append(h("li", { class: "is-retry" }, h("button", { type: "button", onclick: () => player.select(item.vp.viewport) },
        h("span", { class: "t" }, "retry"),
        h("span", { class: "row-head" }, h("strong", {}, `${item.vp.viewport}: failure reproduced`), status("INCONCLUSIVE", "Attempt 1 failed")),
        h("span", { class: "finding" }, `${item.retry.cause_effect ?? item.retry.observed}. The steps below are from attempt ${item.vp.attempts}.`),
      )));
      continue;
    }
    const { vp, s } = item;
    const seekable = vp.recording && s.video_offset_ms != null;
    const button = h("button", {
      type: "button",
      "aria-label": `${vp.viewport}, ${actionText(s.action)}, ${s.result}${seekable ? `, seek recording to about ${formatOffset(s.video_offset_ms)}` : ""}`,
      onclick: () => {
        for (const b of list.querySelectorAll("button")) b.removeAttribute("aria-current");
        button.setAttribute("aria-current", "step");
        player.seek(vp.viewport, seekable ? s.video_offset_ms : null);
      },
    },
      h("span", { class: "t" }, seekable ? `≈${formatOffset(s.video_offset_ms)}` : "–"),
      h("span", { class: "row-head" }, h("strong", {}, `${vp.viewport}: ${actionText(s.action)}`), status(s.result)),
      h("span", { class: "finding" }, s.decision),
    );
    list.append(h("li", { class: s.is_first_blocker ? "is-blocker" : "" }, button));
  }
  return h("section", { class: "panel steps-panel", "aria-label": "Step timeline" },
    h("div", { class: "panel-head" }, h("h2", {}, "Steps"), h("span", { class: "small muted" }, "Times are offsets into the recording (approximate)")),
    list,
  );
}

function detailSections(report) {
  const pay = report.payment;
  const reproduce = h("ol", { class: "steps-list" },
    h("li", {}, "Open ", h("a", { href: report.target.product_url, target: "_blank", rel: "noopener noreferrer" }, report.target.product_url), " at 390×844 (mobile) or 1440×900 (desktop) in Chromium."),
    h("li", {}, "Choose the first available variant and press Add to cart."),
    h("li", {}, "Check that the cart count increases and the cart lists the item."),
    h("li", {}, "Press Check out and confirm the checkout page opens. Do not submit anything."),
  );
  return h("div", { class: "details" },
    h("section", { class: "panel panel-pad" }, h("h2", {}, "Reproduce"), reproduce),
    h("section", { class: "panel panel-pad" }, h("h2", {}, "Browser and timing"), h("dl", { class: "facts" },
      ...report.viewports.flatMap((vp) => [h("dt", {}, vp.viewport), h("dd", {}, `${vp.browser_version} · ${formatDuration(vp.duration_ms)} · ${vp.attempts} attempt(s)`)]),
      h("dt", {}, "Started"), h("dd", { class: "mono" }, formatUtc(report.started_at)),
      h("dt", {}, "Finished"), h("dd", { class: "mono" }, formatUtc(report.completed_at)),
      h("dt", {}, "Fixture build"), h("dd", { class: "mono" }, report.fixture_version ?? "not a fixture"),
      h("dt", {}, "Service build"), h("dd", { class: "mono" }, report.provenance.build),
    )),
    h("section", { class: "panel panel-pad" }, h("h2", {}, "Settlement"), h("dl", { class: "facts" },
      h("dt", {}, "State"), h("dd", {}, pay?.state ?? "–"),
      h("dt", {}, "Amount"), h("dd", {}, pay ? usdc(pay.amount_atomic) : "–"),
      h("dt", {}, "Network"), h("dd", { class: "mono" }, pay?.network ?? "–"),
      h("dt", {}, "Transaction"), h("dd", {}, pay?.settlement_reference ? h("a", { class: "mono", href: `https://basescan.org/tx/${pay.settlement_reference}`, target: "_blank", rel: "noopener noreferrer" }, pay.settlement_reference) : "–"),
      h("dt", {}, "Settled"), h("dd", { class: "mono" }, formatUtc(pay?.settled_at)),
    ), h("p", { class: "small muted" }, "Paying proves the inspection was bought through PayBox. It says nothing about whether the store passed.")),
    h("section", { class: "panel panel-pad" }, h("h2", {}, "Limitations"), h("ul", { class: "steps-list" }, report.limitations.map((l) => h("li", {}, l))),
      h("p", { class: "small muted" }, report.classification_source)),
  );
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderReport(root, report, { compareHref } = {}) {
  const player = createPlayer(report.viewports);
  const copyButton = h("button", { class: "btn btn-quiet btn-sm", type: "button", onclick: async () => {
    try {
      await navigator.clipboard.writeText(summaryText(report));
      copyButton.textContent = "Summary copied";
    } catch {
      copyButton.textContent = "Copy failed";
    }
    setTimeout(() => (copyButton.textContent = "Copy summary"), 2000);
  } }, "Copy summary");
  const created = formatUtc(report.created_at);
  root.replaceChildren(
    h("nav", { class: "crumbs", "aria-label": "Breadcrumb" }, h("a", { href: "/demo" }, "Demo"), " / ", h("span", { "aria-current": "page" }, `Run ${report.run_label}`)),
    h("div", { class: "page-title" },
      h("h1", {}, "Shopper run ", h("span", { class: "mono", style: "font-size:.7em;font-weight:500" }, report.run_label)),
      report.fixture_version ? h("span", { class: "fixture-badge" }, "Controlled test fixture") : null,
      h("div", { class: "actions" },
      copyButton,
      h("button", { class: "btn btn-quiet btn-sm", type: "button", onclick: () => download(`aislerun-${report.run_label}.json`, JSON.stringify(report, null, 2), "application/json") }, "Download JSON"),
      compareHref ? h("a", { class: "btn btn-primary btn-sm", href: compareHref }, "Compare with the paid retest") : null,
    ),
    ),
    h("p", { class: "muted small", style: "margin:0" }, `${created} · `, h("span", { class: "mono" }, report.target.product_url)),
    report.fixture_disclosure ? h("p", { class: "small", style: "margin:6px 0 0;color:var(--warning)" }, report.fixture_disclosure) : null,
    verdictBar(report),
    h("div", { class: "workspace" },
      player.element,
      blockerCard(report),
      timeline(report, player),
    ),
    detailSections(report),
    h("p", { class: "small muted", style: "margin-top:16px" }, `Evidence links on this page expire at ${formatUtc(report.asset_urls_expire_at)}. Reload for fresh ones.`),
  );
  document.title = `${report.run_label} · AisleRun`;
}

/* ---------- Live and stopped states ---------- */

function renderLive(root, inspection, events, problem) {
  const info = statusInfo(inspection.status);
  const last = [...events].reverse().find((e) => e.details?.cause_effect || e.details?.observed || e.details?.step);
  const elapsed = inspection.elapsed_ms != null ? formatDuration(inspection.elapsed_ms) : "not started";
  const label = `AR-${inspection.inspection_id.slice(0, 8).toUpperCase()}`;
  root.replaceChildren(
    h("nav", { class: "crumbs", "aria-label": "Breadcrumb" }, h("a", { href: "/demo" }, "Demo"), " / ", h("span", {}, `Run ${label}`)),
    h("div", { class: "page-title" }, h("h1", {}, "Shopper run ", h("span", { class: "mono", style: "font-size:.7em;font-weight:500" }, label))),
    h("p", { class: "muted small mono", style: "margin:0 0 20px" }, inspection.product_url),
    problem ? h("div", { class: "notice notice-warning", role: "status", style: "margin-bottom:16px" }, h("p", {}, `${problem} Retrying; the last known state is shown below.`)) : null,
    h("section", { class: "panel live", "aria-live": "polite" },
      h("div", { class: "live-head" }, info.kind === "live" ? status("RUNNING", info.title) : status("SERVICE", info.title), h("span", { class: "muted small num" }, `Elapsed ${elapsed}`)),
      h("dl", { class: "live-grid" },
        h("div", {}, h("dt", {}, "What's happening"), h("dd", {}, last?.details?.cause_effect ?? last?.details?.observed ?? info.now)),
        h("div", {}, h("dt", {}, "Waiting on"), h("dd", {}, info.now)),
        h("div", {}, h("dt", {}, "Next"), h("dd", {}, info.next ?? "–")),
      ),
      h("ol", { class: "event-log", reversed: true }, events.slice(-14).reverse().map((e) => h("li", {},
        h("span", { class: "mono muted small" }, formatUtc(e.created_at).slice(11, 19)),
        h("span", {}, h("strong", {}, e.type.replace(/_/g, " ")), e.details?.viewport ? ` · ${e.details.viewport}` : "", e.details?.step ? ` · ${actionText(e.details.step)}` : "", e.details?.observed ? ` — ${e.details.observed}` : ""),
      ))),
    ),
  );
}

function renderStopped(root, inspection, events) {
  const info = statusInfo(inspection.status);
  const label = `AR-${inspection.inspection_id.slice(0, 8).toUpperCase()}`;
  root.replaceChildren(
    h("nav", { class: "crumbs", "aria-label": "Breadcrumb" }, h("a", { href: "/demo" }, "Demo"), " / ", h("span", {}, `Run ${label}`)),
    h("div", { class: "page-title" }, h("h1", {}, info.title)),
    h("div", { class: "notice notice-danger", style: "margin:16px 0" }, h("p", {}, info.now, inspection.error_code ? h("span", { class: "mono" }, ` (${inspection.error_code})`) : null)),
    h("ol", { class: "event-log panel panel-pad" }, events.map((e) => h("li", {}, h("span", { class: "mono muted small" }, formatUtc(e.created_at).slice(11, 19)), h("span", {}, e.type.replace(/_/g, " "), e.details?.observed ? ` — ${e.details.observed}` : "")))),
  );
}

/* ---------- Compare ---------- */

function renderCompare(root, data) {
  const { before, after, repair } = data;
  const mobile = (r) => r.viewports.find((v) => v.viewport === "mobile");
  const players = { before: createPlayer(before.viewports), after: createPlayer(after.viewports) };
  const sideBlock = (key, report, title) => h("section", { "data-side": key, class: "viewer", "aria-label": `${title} recording` },
    h("header", {}, h("h3", {}, `${title} · `, h("a", { href: report.__href ?? "#", class: "mono" }, report.run_label)), status(mobile(report)?.verdict ?? report.overall_verdict, `Mobile ${mobile(report)?.verdict}`)),
    players[key].element,
  );
  const stages = h("div", { class: "compare-stages" }, sideBlock("before", before, "Before"), sideBlock("after", after, "After"));
  const switcher = h("div", { class: "segmented compare-switch", role: "group", "aria-label": "Show run" });
  const setSide = (side) => {
    for (const el of stages.children) el.setAttribute("hidden-narrow", String(el.dataset.side !== side));
    for (const b of switcher.children) b.setAttribute("aria-pressed", String(b.dataset.side === side));
  };
  for (const [side, label] of [["before", "Before"], ["after", "After"]]) {
    switcher.append(h("button", { type: "button", "data-side": side, onclick: () => setSide(side) }, label));
  }
  setSide("before");

  const playBoth = h("button", { class: "btn btn-quiet btn-sm", type: "button", onclick: () => {
    for (const p of Object.values(players)) {
      p.select("mobile");
    }
    const videos = stages.querySelectorAll("video");
    for (const v of videos) {
      v.currentTime = 0;
      v.play().catch(() => undefined);
    }
  } }, "Play both mobile recordings from the start");

  const row = (label, fn) => h("tr", {}, h("th", { scope: "row" }, label), h("td", {}, fn(before)), h("td", {}, fn(after)));
  const vpCell = (r, name) => {
    const vp = r.viewports.find((v) => v.viewport === name);
    return vp ? h("span", {}, status(vp.verdict), " ", viewportSummary(vp)) : "–";
  };
  const cartConfirmed = (r, name) => {
    const s = r.viewports.find((v) => v.viewport === name)?.steps.find((x) => x.action === "confirm_cart");
    return s ? (s.result === "PASS" ? "Yes" : "No") : "Not reached";
  };
  const checkout = (r, name) => {
    const s = r.viewports.find((v) => v.viewport === name)?.steps.find((x) => x.action === "checkout_entry");
    return s?.result === "PASS" ? "Reached" : "Not reached";
  };
  const tx = (r) => r.payment?.settlement_reference
    ? h("a", { class: "mono", href: `https://basescan.org/tx/${r.payment.settlement_reference}`, target: "_blank", rel: "noopener noreferrer" }, `${r.payment.settlement_reference.slice(0, 10)}…`)
    : "–";

  root.replaceChildren(
    h("nav", { class: "crumbs", "aria-label": "Breadcrumb" }, h("a", { href: "/demo" }, "Demo"), " / ", h("span", { "aria-current": "page" }, "Before and after")),
    h("div", { class: "page-title" }, h("h1", {}, "One-line repair. A changed outcome."), h("span", { class: "fixture-badge" }, "Controlled test fixture")),
    h("p", { class: "muted", style: "margin:4px 0 0;max-width:70ch" }, "Two independent inspections of the same product, each paid separately through PayBox. Between them, the fixture's known defect was repaired."),
    h("div", { class: "compare-summary" },
      h("div", { class: "panel side" }, h("h2", {}, "Before"), status(mobile(before)?.verdict), h("p", {}, `Mobile: ${mobile(before)?.attempts > 1 ? `add to cart failed in ${mobile(before).attempts} clean attempts` : viewportSummary(mobile(before))}.`)),
      h("div", { class: "arrow", "aria-hidden": "true" }, "→"),
      h("div", { class: "panel side" }, h("h2", {}, "After"), status(mobile(after)?.verdict), h("p", {}, `Mobile: ${viewportSummary(mobile(after)).toLowerCase()}.`)),
    ),
    h("div", { class: "viewer-bar", style: "margin-bottom:12px" }, switcher, playBoth),
    h("p", { class: "small muted", style: "margin:0 0 12px" }, "Each player is independent. Starting both together is a convenience, not frame-accurate synchronisation."),
    stages,
    h("section", { class: "panel", style: "margin-top:20px" },
      h("div", { class: "panel-head" }, h("h2", {}, "What changed")),
      h("div", { class: "table-scroll" }, h("table", { class: "diff-table" },
        h("thead", {}, h("tr", {}, h("th", { scope: "col" }, ""), h("th", { scope: "col" }, `Before · ${before.run_label}`), h("th", { scope: "col" }, `After · ${after.run_label}`))),
        h("tbody", {},
          row("Fixture", (r) => h("span", { class: "mono" }, r.fixture_version)),
          row("Mobile 390×844", (r) => vpCell(r, "mobile")),
          row("Desktop 1440×900", (r) => vpCell(r, "desktop")),
          row("Mobile cart confirmed", (r) => cartConfirmed(r, "mobile")),
          row("Mobile checkout entry", (r) => checkout(r, "mobile")),
          row("Mobile attempts", (r) => String(mobile(r)?.attempts ?? "–")),
          row("Run duration", (r) => formatDuration(r.duration_ms)),
          row("Paid at", (r) => h("span", { class: "mono" }, formatUtc(r.created_at))),
          row("Settlement", tx),
        ),
      )),
    ),
    repair ? h("section", { class: "panel panel-pad repair", style: "margin-top:20px" },
      h("h2", { style: "font-size:15px;margin:0 0 6px" }, "The repair"),
      h("p", { class: "muted small", style: "margin:0 0 12px" }, repair.note, " ", h("span", { class: "mono" }, repair.file)),
      h("pre", {}, ...repair.before.split("\n").map((l) => h("span", { class: "del" }, `- ${l}\n`)), ...repair.after.split("\n").map((l) => h("span", { class: "add" }, `+ ${l}\n`))),
    ) : null,
    h("p", { class: "small muted", style: "margin-top:16px" }, "A pass means this synthetic journey reached checkout entry. It does not prove every buyer can now check out, and no revenue impact is claimed."),
  );
}

/* ---------- Boot ---------- */

async function bootRun(root) {
  const { id, source, compare } = root.dataset;
  if (source === "demo") {
    try {
      const body = await getJson(`/v1/demo/reports/${id}`);
      renderReport(root, body, { compareHref: compare || undefined });
    } catch (error) {
      errorView(root, error);
    }
    return;
  }
  const token = new URLSearchParams(location.hash.slice(1)).get("token");
  if (!token) {
    errorView(root, { status: 401, message: "" });
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };
  let cursor = 0;
  let events = [];
  let lastInspection = null;
  for (;;) {
    let problem = null;
    try {
      const [inspection, page] = await Promise.all([
        getJson(`/v1/inspections/${id}`, headers),
        getJson(`/v1/inspections/${id}/events?after=${cursor}`, headers),
      ]);
      lastInspection = inspection;
      events = events.concat(page.events);
      cursor = page.next_cursor;
      if (isTerminal(inspection.status)) {
        if (statusInfo(inspection.status).kind === "stopped") renderStopped(root, inspection, events);
        else renderReport(root, await getJson(`/v1/reports/${id}`, headers));
        return;
      }
    } catch (error) {
      if (error.kind !== "network" || !lastInspection) {
        errorView(root, error);
        return;
      }
      problem = "Connection interrupted.";
    }
    renderLive(root, lastInspection, events, problem);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function bootCompare(root) {
  const { source, before, after } = root.dataset;
  try {
    let data;
    if (source === "demo") {
      data = await getJson("/v1/demo/comparison");
      data.before.__href = `/demo/runs/${data.before.inspection_id}`;
      data.after.__href = `/demo/runs/${data.after.inspection_id}`;
    } else {
      const params = new URLSearchParams(location.hash.slice(1));
      data = await getJson(`/v1/comparisons/${before}/${after}`, { "X-Read-Tokens": `${params.get("before") ?? ""},${params.get("after") ?? ""}` });
      data.before.__href = `/runs/${before}#token=${params.get("before")}`;
      data.after.__href = `/runs/${after}#token=${params.get("after")}`;
    }
    renderCompare(root, data);
  } catch (error) {
    errorView(root, error, error.status === 409 ? "These two runs cannot be compared." : "");
  }
}

const root = document.getElementById("app");
if (root?.dataset.page === "run") bootRun(root);
if (root?.dataset.page === "compare") bootCompare(root);
