import Link from "next/link";
import type { DemoRun } from "@/lib/types";
import { verdictWord, viewportSummary } from "@/lib/status";
import { duration, shortHash, utc } from "@/lib/format";
import { VerdictTag } from "./Tag";
import styles from "./runlist.module.css";

const ROLE: Record<string, { title: string; mark: string; tone: string }> = {
  failed: { title: "Broken mobile cart", mark: "1", tone: "fail" },
  retest: { title: "Same product after the fix", mark: "2", tone: "pass" },
  control: { title: "Healthy control store", mark: "C", tone: "pass" },
  blocked: { title: "Store behind a bot check", mark: "B", tone: "unsure" },
};

export function RunList({ runs }: { runs: DemoRun[] }) {
  if (runs.length === 0) {
    return <div className={styles.empty}><h3>No runs are published yet</h3><p>Published inspections show up here with their recordings and payments.</p></div>;
  }
  return (
    <ol className={styles.list}>
      {runs.map(({ role, report }) => {
        const meta = ROLE[role] ?? { title: report.target.label, mark: "•", tone: "neutral" };
        const poster = report.viewports.find((v) => v.viewport === "mobile")?.recording?.poster_url;
        return (
          <li key={report.inspection_id}>
            <Link href={`/demo/runs/${report.inspection_id}`} className={styles.row}>
              <span className={`${styles.mark} ${styles[meta.tone]}`} aria-hidden="true">{meta.mark}</span>
              <span className={styles.thumb} aria-hidden="true">{poster && <img src={poster} alt="" loading="lazy" />}</span>
              <span className={styles.main}>
                <span className="mono">{report.fixture_version}</span>
                <strong>{meta.title}</strong>
                <span className={styles.verdicts}>
                  {report.viewports.map((v) => (
                    <span key={v.viewport} className={styles.vp}>
                      <VerdictTag verdict={v.verdict}>{v.viewport} {verdictWord(v.verdict).toLowerCase()}</VerdictTag>
                      <em>{viewportSummary(v)}</em>
                    </span>
                  ))}
                </span>
              </span>
              <span className={styles.side}>
                <time className="mono">{utc(report.created_at, false)}</time>
                <span className="mono">{duration(report.duration_ms)} run</span>
                {report.payment?.settlement_reference && <span className="mono">tx {shortHash(report.payment.settlement_reference, 6, 4)}</span>}
                <span className={styles.open}>Open run</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

