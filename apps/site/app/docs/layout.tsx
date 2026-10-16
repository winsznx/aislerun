import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { DocsChrome } from '../../components/docs/DocsChrome'
import styles from '../../components/docs/docs.module.css'
import { Logo } from '../../components/Logo'

export const metadata: Metadata = {
  title: { default: 'AisleRun Docs', template: '%s | AisleRun Docs' },
  description: 'How AisleRun works and how an agent orders a run: quotes, paying with PayBox, reading results, verdicts, retests, authorized stores and the API.',
}

function DocsFooter() {
  return (
    <footer className={styles.footer}>
      <nav aria-label="Footer">
        <Link href="/">Home</Link>
        <Link href="/demo">Published runs</Link>
        <Link href="/demo/compare">Before and after</Link>
        <a href="/llms.txt">llms.txt</a>
        <a href="/llms-full.txt">llms-full.txt</a>
      </nav>
      <div className={styles.footerEnd}>
        <Logo size={20} />
        <span>Synthetic shopper runs up to checkout entry. No order is ever placed.</span>
      </div>
    </footer>
  )
}

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsChrome footer={<DocsFooter />}>{children}</DocsChrome>
}
