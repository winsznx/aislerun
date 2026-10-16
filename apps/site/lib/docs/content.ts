import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { DOC_PAGES, SITE_URL, type IndexedDocPage } from './manifest'
import { parseDoc, type ParsedDoc } from './markdown'

export interface Doc extends IndexedDocPage, ParsedDoc {
  markdown: string
}

const CONTENT_DIR = path.join(process.cwd(), 'content', 'docs')
/** Parsed pages keyed by slug, reparsed only when the file changes, so edits show up in `next dev` too. */
const cache = new Map<string, { modified: number; doc: Doc }>()

export function docFilePath(slug: string): string {
  return path.join(CONTENT_DIR, `${slug}.md`)
}

/** Unknown slugs return undefined. A manifest page without its markdown file throws, so a broken link can't ship. */
export function getDoc(slug: string): Doc | undefined {
  const page = DOC_PAGES.find((entry) => entry.slug === slug)
  return page ? loadDoc(page) : undefined
}

export function getAllDocs(): Doc[] {
  return DOC_PAGES.map(loadDoc)
}

function loadDoc(page: IndexedDocPage): Doc {
  const file = docFilePath(page.slug)
  const modified = statSync(file).mtimeMs
  const cached = cache.get(page.slug)
  if (cached?.modified === modified) return cached.doc
  const markdown = readFileSync(file, 'utf8')
  const doc = { ...page, ...parseDoc(markdown, page.title), markdown }
  cache.set(page.slug, { modified, doc })
  return doc
}

/** Markdown for one page as served to LLMs: title, summary and canonical URL first, with links that work outside the site. */
export function docAsMarkdown(doc: Doc): string {
  return `# ${doc.title}\n\n> ${doc.description}\n\nSource: ${doc.url}\n\n${absoluteDocLinks(doc.markdown.trim())}\n`
}

export function absoluteDocLinks(markdown: string): string {
  return markdown.replace(/\]\(\/docs/g, `](${SITE_URL}/docs`)
}
