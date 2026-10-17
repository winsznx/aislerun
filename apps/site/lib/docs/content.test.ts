// Adapted from Floatless (MIT). See apps/site/lib/docs/LICENSE-floatless.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { docFilePath, getAllDocs } from './content'
import { DOC_PAGES, docPath } from './manifest'

// These checks run against the real pages in content/docs, so a broken link or a
// banned character fails CI instead of shipping to the docs site.
describe('docs content', () => {
  it('has a markdown file for every page in the manifest', () => {
    // #given the manifest that drives the sidebar, sitemap and MCP server
    // #then every page it lists exists on disk
    const missing = DOC_PAGES.filter((page) => !existsSync(docFilePath(page.slug))).map((page) => page.slug)
    assert.deepEqual(missing, [])
  })

  it('leaves the page title to the manifest', () => {
    const withH1 = DOC_PAGES.filter((page) => /^#\s/m.test(readFileSync(docFilePath(page.slug), 'utf8'))).map((page) => page.slug)
    assert.deepEqual(withH1, [])
  })

  it('uses no em or en dashes', () => {
    const offenders = DOC_PAGES.filter((page) => /[—–]/.test(readFileSync(docFilePath(page.slug), 'utf8'))).map((page) => page.slug)
    assert.deepEqual(offenders, [])
  })

  it('links only to docs pages and headings that exist', () => {
    // #given every page parsed the way the site renders it
    const docs = getAllDocs()
    const anchors = new Map(docs.map((doc) => [doc.path, new Set(doc.headings.map((heading) => heading.id).concat(allIds(doc.html)))]))
    // #when collecting every /docs link from the rendered HTML
    const broken = docs.flatMap((doc) =>
      [...doc.html.matchAll(/href="(\/docs[^"#]*)(?:#([^"]*))?"/g)].flatMap(([, path = '', anchor]) => {
        const target = anchors.get(path.replace(/\/$/, '') || '/docs')
        if (!target) return [`${doc.slug}: ${path}`]
        if (anchor && !target.has(anchor)) return [`${doc.slug}: ${path}#${anchor}`]
        return []
      }),
    )
    // #then each one resolves to a real page and, when given, a real heading
    assert.deepEqual(broken, [])
  })

  it('serves the introduction at /docs', () => {
    assert.equal(docPath('introduction'), '/docs')
  })
})

function allIds(html: string): string[] {
  return [...html.matchAll(/ id="([^"]+)"/g)].map(([, id = '']) => id)
}
