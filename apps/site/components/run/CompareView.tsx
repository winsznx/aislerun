"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Comparison, Report } from "@/lib/types";
import { verdictWord, viewportSummary } from "@/lib/status";
import { basescan, duration, shortHash, utc } from "@/lib/format";
import { Tag, VerdictTag } from "../Tag";
import { Player, type PlayerHandle } from "./Player";
import { Workspace } from "./Workspace";
import styles from "./compare.module.css";
import run from "./run.module.css";

const mobile = (r: Report) => r.viewports.find((v) => v.viewport === "mobile");
const desktop = (r: Report) => r.viewports.find((v) => v.viewport === "desktop");
const step = (r: Report, viewport: string, action: string) => r.viewports.find((v) => v.viewport === viewport)?.steps.find((s) => s.action === action);

export function CompareView({ data, hrefs }: { data: Comparison; hrefs: { before: string; after: string } }) {
  const { before, after, repair } = data;
  const [side, setSide] = useState<"before" | "after">("before");
  const players = { before: useRef<PlayerHandle>(null), after: useRef<PlayerHandle>(null) };
  const stagesRef = useRef<HTMLDivElement>(null);

  function playBoth() {
    players.before.current?.seek("mobile", 0);
    players.after.current?.seek("mobile", 0);
    stagesRef.current?.querySelectorAll("video").forEach((v) => {
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    });
  }

  const rows: Array<[string, (r: Report) => React.ReactNode]> = [
    ["Fixture build", (r) => <span className="mono">{r.fixture_version}</span>],
    ["Mobile 390 × 844", (r) => <span className={styles.cellRow}><VerdictTag verdict={mobile(r)?.verdict}>{verdictWord(mobile(r)?.verdict)}</VerdictTag>{mobile(r) ? viewportSummary(mobile(r)!) : ""}</span>],
    ["Desktop 1440 × 900", (r) => <span className={styles.cellRow}><VerdictTag verdict={desktop(r)?.verdict}>{verdictWord(desktop(r)?.verdict)}</VerdictTag>{desktop(r) ? viewportSummary(desktop(r)!) : ""}</span>],
    ["Mobile cart confirmed", (r) => (step(r, "mobile", "confirm_cart")?.result === "PASS" ? "Yes" : "No")],
    ["Mobile checkout opened", (r) => (step(r, "mobile", "checkout_entry")?.result === "PASS" ? "Yes" : "Not reached")],
    ["Mobile attempts", (r) => String(mobile(r)?.attempts ?? "–")],
    ["Run time", (r) => <span className="mono">{duration(r.duration_ms)}</span>],
    ["Paid", (r) => <span className="mono">{utc(r.created_at)}</span>],
    ["Settlement", (r) => (r.payment?.settlement_reference ? <a className="mono link" href={basescan(r.payment.settlement_reference)} target="_blank" rel="noopener noreferrer">{shortHash(r.payment.settlement_reference)}</a> : "–")],
  ];

  return (
    <Workspace crumbs={[{ href: "/demo", label: "Runs" }, { label: "Before and after" }]}>
      <div className={run.heading}>
        <div>
          <div className={run.headingTags}><Tag tone="fixture">Controlled test fixture</Tag><Tag tone="paid">Two separate payments</Tag></div>
          <h1>One-line repair, a different outcome</h1>
          <p>Two independent inspections of the same product, each paid for through PayBox. Between them the fixture&apos;s seeded mobile defect was fixed.</p>
        </div>
        <button type="button" className="button secondary" onClick={playBoth}>Play both from the start</button>
      </div>

      <div className={styles.pair}>
        <SummaryCard label="Before" report={before} href={hrefs.before} />
        <span className={styles.arrow} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </span>
        <SummaryCard label="After" report={after} href={hrefs.after} />
      </div>

      <div className={styles.switch} role="group" aria-label="Show recording">
        <button type="button" aria-pressed={side === "before"} onClick={() => setSide("before")}>Before</button>
        <button type="button" aria-pressed={side === "after"} onClick={() => setSide("after")}>After</button>
      </div>

      <div className={styles.stages} ref={stagesRef}>
        {(["before", "after"] as const).map((key) => (
          <section key={key} className={`${run.module} ${styles.side}`} data-hidden-narrow={side !== key} aria-label={`${key} recording`}>
            <Player ref={players[key]} viewports={(key === "before" ? before : after).viewports} compact label={`${key} recording`} />
          </section>
        ))}
      </div>
      <p className={styles.footnote}>Each player runs on its own. Starting both together is a convenience, not frame-accurate sync.</p>

      <section className={run.module} style={{ marginTop: 16 }}>
        <div className={run.moduleHead}><h2>What changed</h2></div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th scope="col" /><th scope="col">Before · {before.run_label}</th><th scope="col">After · {after.run_label}</th></tr></thead>
            <tbody>
              {rows.map(([label, cell]) => (
                <tr key={label}><th scope="row">{label}</th><td>{cell(before)}</td><td>{cell(after)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {repair && (
        <section className={run.module} style={{ marginTop: 16 }}>
          <div className={run.moduleHead}><h2>The repair</h2><span className="mono">{repair.file}</span></div>
          <p className={run.note} style={{ marginTop: 0, marginBottom: 12 }}>{repair.note}</p>
          <pre className={styles.diff}>
            {repair.before.split("\n").map((l) => <span key={`b-${l}`} className={styles.del}>{`- ${l}\n`}</span>)}
            {repair.after.split("\n").map((l) => <span key={`a-${l}`} className={styles.add}>{`+ ${l}\n`}</span>)}
          </pre>
        </section>
      )}
      <p className={run.expiry}>A pass means this synthetic journey reached checkout. It doesn&apos;t prove every buyer can now check out, and no revenue impact is claimed.</p>
    </Workspace>
  );
}

function SummaryCard({ label, report, href }: { label: string; report: Report; href: string }) {
  const m = mobile(report);
  return (
    <Link href={href} className={styles.summary}>
      <span className={styles.summaryLabel}>{label}</span>
      <strong>{m ? (m.verdict === "PASS" ? "Mobile reached checkout" : `Mobile: ${viewportSummary(m).toLowerCase()}`) : report.status}</strong>
      <span className={styles.summaryMeta}>
        <VerdictTag verdict={m?.verdict}>{verdictWord(m?.verdict)}</VerdictTag>
        <span className="mono">{report.run_label}</span>
        {m && m.attempts > 1 && <span>failed in {m.attempts} clean browsers</span>}
      </span>
    </Link>
  );
}
