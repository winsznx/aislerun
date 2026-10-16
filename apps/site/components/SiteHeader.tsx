import Link from "next/link";
import { Logo } from "./Logo";
import styles from "./site.module.css";

export function SiteHeader({ current }: { current?: "home" | "demo" | "docs" }) {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Link href="/" aria-label="AisleRun home"><Logo /></Link>
        <nav aria-label="Main" className={styles.nav}>
          <Link href="/#how" className={styles.optional}>How it works</Link>
          <Link href="/demo" aria-current={current === "demo" ? "page" : undefined}>Runs</Link>
          <Link href="/docs" aria-current={current === "docs" ? "page" : undefined} className={styles.optional}>Docs</Link>
        </nav>
        <Link href="/demo/compare" className={`button small ${styles.cta}`}>See the retest</Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div>
          <Logo size={22} />
          <p>Synthetic shopper journeys up to checkout entry. AisleRun never places an order.</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/demo">Runs</Link>
          <Link href="/demo/compare">Before and after</Link>
          <Link href="/docs">Docs</Link>
          <Link href="/docs#limits">Limitations</Link>
        </nav>
      </div>
    </footer>
  );
}
