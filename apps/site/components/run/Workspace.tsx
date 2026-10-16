import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "../Logo";
import styles from "./run.module.css";

// Product shell after closeout's app: a grey page, one white rounded workspace, a topbar with
// breadcrumbs on the left and page actions on the right.
export function Workspace({ crumbs, actions, children }: { crumbs: Array<{ href?: string; label: string }>; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.shellBar}>
        <Link href="/" aria-label="AisleRun home"><Logo size={24} /></Link>
        <nav aria-label="Main" className={styles.shellNav}>
          <Link href="/demo">Runs</Link>
          <Link href="/docs">Docs</Link>
        </nav>
      </div>
      <main id="main" className={styles.workspace}>
        <div className={styles.topbar}>
          <nav aria-label="Breadcrumb" className={styles.crumbs}>
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`}>
                {i > 0 && <span className={styles.crumbDivider} aria-hidden="true">/</span>}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
          {actions && <div className={styles.topbarActions}>{actions}</div>}
        </div>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
