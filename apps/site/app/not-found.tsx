import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import styles from "./marketing.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main id="main" className={`container ${styles.pageTop}`}>
        <div className={styles.sectionHeading}>
          <h1>This page doesn&apos;t exist.</h1>
          <p>The run may not be published, or the link is mistyped. Published runs are all on one page.</p>
        </div>
        <Link className="button" href="/demo">See published runs</Link>
      </main>
      <SiteFooter />
    </div>
  );
}
