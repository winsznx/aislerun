// Adapted from Floatless (MIT). See apps/site/lib/docs/LICENSE-floatless.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseDoc } from './markdown'
import { findDocTarget, searchDocs, type FetchableDoc } from './search'

function doc(slug: string, title: string, markdown: string): FetchableDoc {
  const { chunks, sections } = parseDoc(markdown, title)
  return { slug, title, url: `https://aislerun.vercel.app/docs/${slug}`, chunks, sections }
}

const DOCS = [
  doc('introduction', 'What is AisleRun', 'AisleRun is a mobile money app on Monad.\n\n## Who it is for\n\nPeople who save in digital dollars.'),
  doc(
    'aislerun-payments',
    'AisleRun Payments',
    'Earn on AUSD you are not spending.\n\n## Withdraw\n\nYou can withdraw whenever Morpho has the liquidity. Withdrawals go back to your wallet.\n\n## Fees\n\nAisleRun takes 10% of the interest.',
  ),
  doc('spending-rules', 'Spending rules', 'Rules you sign.\n\n## Daily limit\n\nA daily limit caps what you send per day.'),
]

describe('searchDocs', () => {
  it('ranks the section that matches the query best', () => {
    // #given a question written the way a person asks it
    // #when it's searched across every page
    const [top] = searchDocs(DOCS, 'how do I withdraw my savings')
    // #then the withdraw section comes first, with a link straight to it
    assert.ok(top)
    assert.equal(top.id, 'aislerun-payments#withdraw')
    assert.equal(top.title, 'AisleRun Payments: Withdraw')
    assert.equal(top.url, 'https://aislerun.vercel.app/docs/aislerun-payments#withdraw')
    assert.match(top.snippet, /withdraw whenever Morpho/)
  })

  it('matches longer forms and light plurals of a term', () => {
    assert.equal(searchDocs(DOCS, 'withdrawals')[0]?.id, 'aislerun-payments#withdraw')
    assert.equal(searchDocs(DOCS, 'limits')[0]?.id, 'spending-rules#daily-limit')
  })

  it('uses the page id for text before the first section', () => {
    assert.equal(searchDocs(DOCS, 'mobile money app')[0]?.id, 'introduction')
  })

  it('returns nothing for empty or unmatched queries', () => {
    assert.deepEqual(searchDocs(DOCS, '   '), [])
    assert.deepEqual(searchDocs(DOCS, 'zzzz'), [])
  })

  it('returns at most two results per page and respects the limit', () => {
    const results = searchDocs(DOCS, 'aislerun', 10)
    const perPage = new Map<string, number>()
    for (const result of results) perPage.set(result.id.split('#')[0] ?? '', (perPage.get(result.id.split('#')[0] ?? '') ?? 0) + 1)
    assert.ok([...perPage.values()].every((count) => count <= 2))
    assert.equal(searchDocs(DOCS, 'aislerun', 1).length, 1)
  })
})

describe('findDocTarget', () => {
  it('resolves ids, docs paths and full URLs', () => {
    assert.equal(findDocTarget(DOCS, 'aislerun-payments')?.doc.slug, 'aislerun-payments')
    assert.equal(findDocTarget(DOCS, 'aislerun-payments#fees')?.section?.heading, 'Fees')
    assert.equal(findDocTarget(DOCS, '/docs/spending-rules#daily-limit')?.section?.id, 'daily-limit')
    assert.equal(findDocTarget(DOCS, 'https://aislerun.vercel.app/docs/aislerun-payments.md')?.doc.slug, 'aislerun-payments')
    assert.equal(findDocTarget(DOCS, 'https://aislerun.vercel.app/docs')?.doc.slug, 'introduction')
  })

  it('returns undefined for unknown pages and sections', () => {
    assert.equal(findDocTarget(DOCS, 'nope'), undefined)
    assert.equal(findDocTarget(DOCS, 'aislerun-payments#nope'), undefined)
  })
})
