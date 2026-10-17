// Adapted from Floatless (MIT). See apps/site/lib/docs/LICENSE-floatless.
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Doc } from '../../lib/docs/content'
import { DOC_PAGES, SITE_URL } from '../../lib/docs/manifest'
import { DocToc } from './DocToc'
import styles from './docs.module.css'

/** Long pages like the FAQ and glossary list only their `##` sections. */
const MAX_TOC_ENTRIES = 24

function structuredData(doc: Doc): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: doc.title,
    description: doc.description,
    url: doc.url,
    articleSection: doc.section,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'AisleRun', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'AisleRun', url: SITE_URL },
  }
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function DocArticle({ doc, beforeContent, afterContent }: { doc: Doc; beforeContent?: ReactNode; afterContent?: ReactNode }) {
  const index = DOC_PAGES.findIndex((page) => page.slug === doc.slug)
  const previous = index > 0 ? DOC_PAGES[index - 1] : undefined
  const next = index >= 0 && index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : undefined
  const toc = doc.headings.length > MAX_TOC_ENTRIES ? doc.headings.filter((heading) => heading.depth === 2) : doc.headings

  return (
    <div className={styles.page}>
      <article className={styles.article}>
        <script dangerouslySetInnerHTML={{ __html: structuredData(doc) }} type="application/ld+json" />
        <p className={styles.crumb}>{doc.section}</p>
        <h1 className={styles.title}>{doc.title}</h1>
        <p className={styles.lead}>{doc.description}</p>
        <div className={styles.pageTools}>
          <a href={`/docs/${doc.slug}.md`}>View as Markdown</a>
          {doc.slug === 'paying-with-paybox' ? null : <Link href="/docs/paying-with-paybox">Order from an agent</Link>}
        </div>
        {toc.length > 0 ? (
          <details className={styles.mobileToc}>
            <summary>On this page</summary>
            <ul>
              {toc.map((heading) => (
                <li className={heading.depth === 3 ? styles.tocDeep : undefined} key={heading.id}>
                  <a href={`#${heading.id}`}>{heading.text}</a>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {beforeContent}
        <div className={styles.prose} dangerouslySetInnerHTML={{ __html: doc.html }} />
        {afterContent}
        {previous || next ? (
          <nav aria-label="More docs" className={styles.pager}>
            {previous ? (
              <Link href={previous.path}>
                <span>Previous</span>
                <strong>{previous.title}</strong>
              </Link>
            ) : null}
            {next ? (
              <Link className={styles.pagerNext} href={next.path}>
                <span>Next</span>
                <strong>{next.title}</strong>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </article>
      {toc.length > 0 ? <DocToc headings={toc} /> : null}
    </div>
  )
}
