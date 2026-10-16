"use client";

import { useEffect, useState } from "react";
import { ApiError, getInspection, getPrivateReport } from "@/lib/api";
import { actionText, isTerminal, statusInfo } from "@/lib/status";
import { duration, utc } from "@/lib/format";
import type { InspectionStatus, Report, RunEvent } from "@/lib/types";
import { ReportView } from "./ReportView";
import { RunState } from "./RunState";
import { Workspace } from "./Workspace";
import styles from "./run.module.css";

type View =
  | { kind: "loading" }
  | { kind: "no-token" }
  | { kind: "error"; error: ApiError | Error }
  | { kind: "live"; inspection: InspectionStatus; events: RunEvent[]; interrupted: boolean }
  | { kind: "stopped"; inspection: InspectionStatus; events: RunEvent[] }
  | { kind: "report"; report: Report };

const POLL_MS = 2000;

export function PrivateRun({ id }: { id: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) {
      setView({ kind: "no-token" });
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    let cursor = 0;
    let events: RunEvent[] = [];
    let last: InspectionStatus | null = null;

    async function tick() {
      try {
        const [inspection, page] = await Promise.all([
          getInspection<InspectionStatus>(id, token!),
          getInspection<{ events: RunEvent[]; next_cursor: number }>(id, token!, `/events?after=${cursor}`),
        ]);
        if (cancelled) return;
        last = inspection;
        events = events.concat(page.events);
        cursor = page.next_cursor;
        if (isTerminal(inspection.status)) {
          if (statusInfo(inspection.status).kind === "stopped") setView({ kind: "stopped", inspection, events });
          else {
            const report = await getPrivateReport(id, token!);
            if (!cancelled) setView({ kind: "report", report });
          }
          return;
        }
        setView({ kind: "live", inspection, events, interrupted: false });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError || !last) {
          setView({ kind: "error", error: error as Error });
          return;
        }
        setView({ kind: "live", inspection: last, events, interrupted: true });
      }
      timer = window.setTimeout(tick, POLL_MS);
    }

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [id]);

  const crumbs = { href: "/demo", label: "Runs" };
  const label = `AR-${id.slice(0, 8).toUpperCase()}`;

  switch (view.kind) {
    case "report":
      return <ReportView report={view.report} crumbs={crumbs} />;
    case "loading":
      return <Workspace crumbs={[crumbs, { label }]}><p className={styles.caption}>Loading run…</p></Workspace>;
    case "no-token":
      return <RunState crumbs={crumbs} label={label} title="This link has no read token" body="Private reports open only with the report_url returned by the paid request. Published runs are on the Runs page." />;
    case "error": {
      const status = view.error instanceof ApiError ? view.error.status : 0;
      const denied = status === 401 || status === 403;
      return (
        <RunState
          crumbs={crumbs}
          label={label}
          title={denied ? "This report link isn't valid" : status === 404 ? "Run not found" : "Couldn't load this run"}
          body={denied ? "The read token is missing, wrong or no longer accepted. AisleRun never makes a private report public to work around this." : view.error.message}
        />
      );
    }
    case "stopped": {
      const info = statusInfo(view.inspection.status);
      return (
        <Workspace crumbs={[crumbs, { label }]}>
          <div className={styles.state}>
            <span className="tag neutral">{view.inspection.error_code ?? view.inspection.status}</span>
            <h1 style={{ marginTop: 12 }}>{info.title}</h1>
            <p>{info.now}</p>
          </div>
          <EventList events={view.events} />
        </Workspace>
      );
    }
    case "live": {
      const info = statusInfo(view.inspection.status);
      const latest = [...view.events].reverse().find((e) => e.details?.cause_effect || e.details?.observed);
      return (
        <Workspace crumbs={[crumbs, { label }]}>
          {view.interrupted && <p className={styles.banner} role="status">Connection interrupted. Retrying; the last known state is below.</p>}
          <div className={styles.liveHead} aria-live="polite">
            <span className={styles.pulse} aria-hidden="true" />
            <h1 className={styles.heading} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{info.title}</h1>
            <span className="mono" style={{ color: "var(--ink-muted)" }}>{view.inspection.elapsed_ms != null ? `${duration(view.inspection.elapsed_ms)} elapsed` : "not started"}</span>
          </div>
          <dl className={styles.liveGrid}>
            <div><dt>Happening now</dt><dd>{latest?.details.cause_effect ?? latest?.details.observed ?? info.now}</dd></div>
            <div><dt>Waiting on</dt><dd>{info.now}</dd></div>
            <div><dt>Next</dt><dd>{info.next ?? "–"}</dd></div>
          </dl>
          <EventList events={view.events.slice(-14).reverse()} />
        </Workspace>
      );
    }
  }
}

function EventList({ events }: { events: RunEvent[] }) {
  return (
    <ol className={styles.events}>
      {events.map((e) => (
        <li key={e.seq}>
          <span className="mono">{utc(e.created_at).slice(11, 19)}</span>
          <span>
            <strong>{e.type.replace(/_/g, " ")}</strong>
            {e.details?.viewport ? ` · ${e.details.viewport}` : ""}
            {e.details?.step ? ` · ${actionText(e.details.step)}` : ""}
            {e.details?.observed ? `: ${e.details.observed}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
