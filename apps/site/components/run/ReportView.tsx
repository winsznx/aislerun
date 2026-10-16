"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Report, ViewportReport } from "@/lib/types";
import { actionText, blockerText, tagTone, verdictWord, viewportSummary } from "@/lib/status";
import { basescan, capital, duration, offset, shortHash, usdc, utc } from "@/lib/format";
import { Tag, VerdictTag } from "../Tag";
import { Player, type PlayerHandle } from "./Player";
import { Workspace } from "./Workspace";
import styles from "./run.module.css";

function firstBlocker(report: Report) {
  for (const v of report.viewports) {
    const step = v.steps.find((s) => s.is_first_blocker);
    if (step) return { v, step };
  }
  return null;
}

function headline(report: Report): string {
  const found = firstBlocker(report);
  if (found) return `${capital(found.v.viewport)}: ${blockerText(found.v.blocker)?.toLowerCase() ?? found.step.result.toLowerCase()}`;
  if (report.overall_verdict === "PASS") return "Both viewports reached checkout";
  return "No verdict for this run";
}

export function summaryText(report: Report): string {
  const lines = [
    `AisleRun ${report.run_label} (${report.inspection_id})`,
    `Target: ${report.target.product_url}${report.fixture_version ? ` [controlled test fixture ${report.fixture_version}]` : ""}`,
    `Overall: ${report.overall_verdict ?? report.status}`,
    ...report.viewports.map((v) => `${v.viewport} ${v.size.width}x${v.size.height}: ${v.verdict}${v.blocker ? ` (${v.blocker})` : ""}, ${v.attempts} attempt(s)`),
  ];
  const found = firstBlocker(report);
  if (found) lines.push(`First blocker on ${found.v.viewport}: ${found.step.decision}`);
  if (report.payment?.settlement_reference) lines.push(`Paid via PayBox/x402: ${usdc(report.payment.amount_atomic)} on ${report.payment.network}, tx ${report.payment.settlement_reference}`);
  lines.push("Checkout entry only. No order was placed.");
  return lines.join("\n");
}

function ViewportTile({ v }: { v: ViewportReport }) {
  return (
    <div className={styles.tile}>
      <div className={styles.tileTop}>
        <span className={`${styles.tileIcon} ${styles[tagTone(v.verdict)]}`} aria-hidden="true">
          {v.viewport === "mobile" ? <PhoneIcon /> : <DesktopIcon />}
        </span>
        <div>
          <span>{capital(v.viewport)} · {v.size.width} × {v.size.height}</span>
          <strong>{verdictWord(v.verdict)}</strong>
        </div>
      </div>
      <p className={styles.tileFoot}>
        {viewportSummary(v)}
        {v.blocker && <span className="mono">{v.blocker}</span>}
      </p>
    </div>
  );
}

export function ReportView({ report, compareHref, crumbs }: { report: Report; compareHref?: string; crumbs: { href: string; label: string } }) {
  const player = useRef<PlayerHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [stepsViewport, setStepsViewport] = useState<string>((firstBlocker(report)?.v ?? report.viewports[0])?.viewport ?? "mobile");
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const found = firstBlocker(report);
  const pay = report.payment;

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText(report));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 1800);
  }

  function downloadJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `aislerun-${report.run_label}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const actions = (
    <>
      <button type="button" className="button secondary small" onClick={copySummary}>
        {copied === "done" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy summary"}
      </button>
      <button type="button" className="button secondary small" onClick={downloadJson}>Download JSON</button>
    </>
  );

  return (
    <Workspace crumbs={[crumbs, { label: report.run_label }]} actions={actions}>
      <div className={styles.heading}>
        <div>
          <div className={styles.headingTags}>
            {report.fixture_version && <Tag tone="fixture">Controlled test fixture</Tag>}
            <VerdictTag verdict={report.overall_verdict}>{verdictWord(report.overall_verdict)}</VerdictTag>
          </div>
          <h1>{headline(report)}</h1>
          <p>
            {utc(report.created_at)} · <span className="mono">{report.target.product_url.replace(/^https:\/\//, "")}</span>
          </p>
        </div>
        {compareHref && <Link className="button" href={compareHref}>Compare with the retest</Link>}
      </div>

      <div className={styles.tiles}>
        {report.viewports.map((v) => <ViewportTile key={v.viewport} v={v} />)}
        <div className={styles.tile}>
          <div className={styles.tileTop}>
            <span className={`${styles.tileIcon} ${styles.paid}`} aria-hidden="true"><CoinIcon /></span>
            <div>
              <span>Paid through PayBox</span>
              <strong>{pay ? usdc(pay.amount_atomic) : "–"}</strong>
            </div>
          </div>
          <p className={styles.tileFoot}>
            {pay?.state === "SETTLED" ? "Settled on Base" : pay?.state ?? "No payment"}
            {pay?.settlement_reference && (
              <a className="mono link" href={basescan(pay.settlement_reference)} target="_blank" rel="noopener noreferrer">{shortHash(pay.settlement_reference, 8, 4)}</a>
            )}
          </p>
        </div>
      </div>

      <div className={styles.modules}>
        <div className={styles.module}>
          <Player ref={player} viewports={report.viewports} />
        </div>

        <div className={styles.side}>
          {found ? (
            <section className={`${styles.module} ${styles.finding}`} aria-label="First blocker">
              <div className={styles.moduleHead}>
                <h2>{found.step.result === "INCONCLUSIVE" ? "Why there's no verdict" : "First blocker"}</h2>
                <VerdictTag verdict={found.step.result}>{found.v.viewport}</VerdictTag>
              </div>
              <dl className={styles.obsExp}>
                <div><dt>Observed</dt><dd>{found.step.decision}</dd></div>
                <div><dt>Expected</dt><dd>{found.step.expected}</dd></div>
              </dl>
              {found.v.attempts > 1 && <p className={styles.note}>Reproduced in {found.v.attempts} separate clean browsers.</p>}
              {found.v.console_errors[0] && (
                <p className={styles.note}>
                  Possible cause, from the page's console: <code className="mono">{found.v.console_errors[0].replace(/^\[[^\]]+\]\s*/, "")}</code>
                </p>
              )}
            </section>
          ) : (
            <section className={`${styles.module} ${styles.finding}`} aria-label="Finding">
              <div className={styles.moduleHead}><h2>No blocker</h2><VerdictTag verdict={report.overall_verdict}>{verdictWord(report.overall_verdict)}</VerdictTag></div>
              <p className={styles.note}>Both viewports added the item to the cart and opened checkout. Nothing was submitted.</p>
            </section>
          )}

          <section className={styles.module} aria-label="Steps">
            <div className={styles.moduleHead}>
              <h2>Steps</h2>
              <div className={styles.segmented} role="group" aria-label="Steps for viewport">
                {report.viewports.map((v) => (
                  <button
                    key={v.viewport}
                    type="button"
                    aria-pressed={stepsViewport === v.viewport}
                    onClick={() => {
                      setStepsViewport(v.viewport);
                      player.current?.seek(v.viewport, null);
                    }}
                  >
                    {capital(v.viewport)}
                  </button>
                ))}
              </div>
            </div>
            <p className={styles.stepsHint}>Select a step to jump the recording to it.</p>
            <ol className={styles.steps}>
              {report.viewports.filter((v) => v.viewport === stepsViewport).flatMap((v) => [
                ...(v.retry
                  ? [
                      <li key={`${v.viewport}-retry`}>
                        <div className={`${styles.stepRow} ${styles.stepInfo}`}>
                          <span className={`${styles.stepMark} ${styles.unsure}`} aria-hidden="true">↻</span>
                          <span className={styles.stepMain}>
                            <span>Attempt 1</span>
                            <strong>Failed, so the journey was repeated in a clean browser</strong>
                          </span>
                          <span className={styles.stepTime} />
                        </div>
                      </li>,
                    ]
                  : []),
                ...v.steps.map((s) => {
                  const id = `${v.viewport}-${s.ordinal}`;
                  const seekable = Boolean(v.recording) && s.video_offset_ms != null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={`${styles.stepRow} ${s.is_first_blocker ? styles.stepBlocker : ""}`}
                        aria-current={selected === id ? "step" : undefined}
                        onClick={() => {
                          setSelected(id);
                          player.current?.seek(v.viewport, seekable ? s.video_offset_ms : null);
                        }}
                      >
                        <span className={`${styles.stepMark} ${styles[tagTone(s.result)]}`} aria-hidden="true">{s.ordinal}</span>
                        <span className={styles.stepMain}>
                          {v.attempts > 1 && <span>Attempt {v.attempts}</span>}
                          <strong>{actionText(s.action)}</strong>
                          <em>{s.decision}</em>
                        </span>
                        <span className={styles.stepTime}>
                          <span className={`tag ${tagTone(s.result)}`}>{s.result === "SKIPPED" ? "skip" : s.result.toLowerCase()}</span>
                          <span className="mono">{seekable ? offset(s.video_offset_ms) : ""}</span>
                        </span>
                      </button>
                    </li>
                  );
                }),
              ])}
            </ol>
          </section>
        </div>
      </div>

      <div className={styles.details}>
        <section className={styles.module}>
          <div className={styles.moduleHead}><h2>Reproduce it yourself</h2></div>
          <ol className={styles.numbered}>
            <li>Open <a className="link" href={report.target.product_url} target="_blank" rel="noopener noreferrer">the product page</a> in Chromium at 390 × 844 or 1440 × 900.</li>
            <li>Pick the first available variant and press Add to cart.</li>
            <li>Check the cart count goes up and the cart lists the item.</li>
            <li>Press Check out and confirm the checkout page opens. Don't submit anything.</li>
          </ol>
        </section>
        <section className={styles.module}>
          <div className={styles.moduleHead}><h2>Run details</h2></div>
          <dl className={styles.facts}>
            {report.viewports.map((v) => (
              <div key={v.viewport}><dt>{capital(v.viewport)}</dt><dd>{duration(v.duration_ms)} · {v.attempts} attempt{v.attempts > 1 ? "s" : ""}</dd></div>
            ))}
            <div><dt>Browser</dt><dd className="mono">{report.viewports[0]?.browser_version ?? "–"}</dd></div>
            <div><dt>Fixture build</dt><dd className="mono">{report.fixture_version ?? "Not a fixture"}</dd></div>
            <div><dt>Started</dt><dd className="mono">{utc(report.started_at)}</dd></div>
            <div><dt>Finished</dt><dd className="mono">{utc(report.completed_at)}</dd></div>
            <div><dt>Run ID</dt><dd className="mono">{report.inspection_id}</dd></div>
          </dl>
        </section>
        <section className={styles.module}>
          <div className={styles.moduleHead}><h2>Payment</h2></div>
          <dl className={styles.facts}>
            <div><dt>State</dt><dd>{pay?.state === "SETTLED" ? "Settled" : pay?.state ?? "–"}</dd></div>
            <div><dt>Amount</dt><dd>{pay ? usdc(pay.amount_atomic) : "–"}</dd></div>
            <div><dt>Network</dt><dd className="mono">{pay?.network ?? "–"}</dd></div>
            <div><dt>Transaction</dt><dd>{pay?.settlement_reference ? <a className="mono link" href={basescan(pay.settlement_reference)} target="_blank" rel="noopener noreferrer">{pay.settlement_reference}</a> : "–"}</dd></div>
            <div><dt>Settled</dt><dd className="mono">{utc(pay?.settled_at)}</dd></div>
          </dl>
          <p className={styles.note}>The payment shows this run was bought through PayBox. It says nothing about whether the store passed.</p>
        </section>
        <section className={styles.module}>
          <div className={styles.moduleHead}><h2>Limits of this result</h2></div>
          <ul className={styles.bullets}>{report.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className={styles.note}>{report.classification_source}</p>
        </section>
      </div>
      <p className={styles.expiry}>Evidence links on this page work until {utc(report.asset_urls_expire_at)}. Reload for fresh ones.</p>
    </Workspace>
  );
}

function PhoneIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" strokeLinecap="round" /></svg>;
}
function DesktopIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2.5" y="4" width="19" height="13" rx="2" /><path d="M8.5 21h7M12 17v4" strokeLinecap="round" /></svg>;
}
function CoinIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.6 0-2.7.8-2.7 2s1 1.7 2.7 2 2.8.8 2.8 2.1-1.2 2-2.8 2c-1.2 0-2.2-.5-2.7-1.3M12 6.5V8m0 8v1.5" strokeLinecap="round" /></svg>;
}
