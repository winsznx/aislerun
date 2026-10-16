import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { RunList } from "@/components/RunList";
import { getDemoRuns } from "@/lib/api";
import styles from "../marketing.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Runs", description: "PayBox-paid AisleRun inspections of a controlled test store: broken, repaired, healthy and bot-checked." };

export default async function DemoPage() {
  const runs = await getDemoRuns();
  return (
    <div className={styles.page}>
      <SiteHeader current="demo" />
      <main id="main" className={`container ${styles.pageTop}`}>
        <span className="eyebrow"><span className="mark" aria-hidden="true">✳</span>Controlled test store</span>
        <div className={styles.sectionHeading}>
          <h1>Real paid runs. One broken step. One verified repair.</h1>
          <p>Each run was bought by an agent through PayBox and executed in real Chromium against AisleRun&apos;s own labelled fixture. No purchase was ever placed.</p>
        </div>
        <RunList runs={runs} />
        <div className={styles.listFoot}>
          <Link className="button" href="/demo/compare">Compare broken and repaired</Link>
        </div>
        <p className={styles.fineprint}>
          The broken fixture has a defect seeded on purpose and the fixed fixture is that one-line repair. A payment shows a run was bought; it says nothing about whether the store passed.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
