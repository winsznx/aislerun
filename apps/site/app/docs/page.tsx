import type { Metadata } from 'next'
import Link from 'next/link'
import { CopyButton } from '../../components/docs/CopyButton'
import { DocArticle } from '../../components/docs/DocArticle'
import styles from '../../components/docs/docs.module.css'
import { getDoc } from '../../lib/docs/content'
import { API_URL, DOC_SECTIONS, INTRODUCTION_SLUG, docPath } from '../../lib/docs/manifest'

const START_HERE = [
  { slug: 'quickstart', title: 'Order your first run', blurb: 'Quote, pay through PayBox and read the result.' },
  { slug: 'verdicts', title: 'Read a verdict', blurb: 'What pass, fail and inconclusive mean, and every blocker.' },
  { slug: 'retests', title: 'Prove a fix', blurb: 'Pay for a retest and compare the two recordings.' },
  { slug: 'proof', title: 'Check it yourself', blurb: 'Every paid run, with its settlement on Base.' },
]

export const metadata: Metadata = {
  title: { absolute: 'AisleRun Docs' },
  description: 'How AisleRun works and how an agent orders a run: quotes, paying with PayBox, reading results, verdicts, retests, authorized stores and the API.',
  alternates: { canonical: '/docs', types: { 'text/markdown': '/docs/introduction.md' } },
}

export default function DocsHome() {
  const doc = getDoc(INTRODUCTION_SLUG)
  if (!doc) throw new Error('The introduction page is missing from the docs manifest.')
  const endpoint = `${API_URL}/v1/inspections`

  return (
    <DocArticle
      afterContent={
        <>
          <section aria-labelledby="agent-title" className={styles.assistant}>
            <h2 id="agent-title">Order a run from your agent</h2>
            <p>
              Any agent connected to PayBox can buy a run. It calls the <code>use_service</code> tool with this URL, a POST body from a free quote, and your wallet
              credential. PayBox pays, and the agent gets the run ID and a report link back.
            </p>
            <div className={styles.endpoint}>
              <code>{endpoint}</code>
              <CopyButton label="Copy URL" value={endpoint} />
            </div>
            <div className={styles.assistantClients}>
              <div>
                <strong>Price</strong>
                <span>0.05 USDC per run, paid on Base through x402.</span>
              </div>
              <div>
                <strong>Time</strong>
                <span>About 6 seconds to pay, then 7 to 19 seconds for the run.</span>
              </div>
              <div>
                <strong>Result</strong>
                <span>A verdict per viewport, with the recording and the first step that broke.</span>
              </div>
            </div>
            <Link href="/docs/quickstart">Step-by-step: order your first run</Link>
          </section>
          <section aria-labelledby="index-title" className={styles.index}>
            <h2 id="index-title">All docs</h2>
            <div className={styles.indexGrid}>
              {DOC_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3>{section.title}</h3>
                  <ul>
                    {section.pages.map((page) => (
                      <li key={page.slug}>
                        <Link href={docPath(page.slug)}>{page.title}</Link>
                        <p>{page.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      }
      beforeContent={
        <nav aria-label="Start here" className={styles.startGrid}>
          {START_HERE.map((item) => (
            <Link href={docPath(item.slug)} key={item.slug}>
              <strong>{item.title}</strong>
              <span>{item.blurb}</span>
            </Link>
          ))}
        </nav>
      }
      doc={doc}
    />
  )
}
