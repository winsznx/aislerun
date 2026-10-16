import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseDoc, slugifyHeading } from './markdown'

describe('slugifyHeading', () => {
  it('lowercases and joins words with single hyphens', () => {
    assert.equal(slugifyHeading('Who can change what'), 'who-can-change-what')
    assert.equal(slugifyHeading('What’s live today?'), 'what-s-live-today')
    assert.equal(slugifyHeading('Fees & limits'), 'fees-limits')
    assert.equal(slugifyHeading('  `MORPHO_VAULT_ADDRESS` means two vaults '), 'morpho-vault-address-means-two-vaults')
  })
})

describe('parseDoc', () => {
  const markdown = [
    'AisleRun keeps money productive.',
    '',
    '## Fees',
    '',
    'AisleRun takes 10% of interest. See [savings](/docs/aislerun-payments) and [Morpho](https://docs.morpho.org).',
    '',
    '### Network fees',
    '',
    '| Fee | Amount |',
    '| --- | --- |',
    '| Savings | 10% of interest |',
    '',
    '> Note: fees are paid in MON.',
    '',
    '## Fees',
    '',
    '<script>alert(1)</script>',
    '',
    '```sh',
    'forge test',
    '```',
  ].join('\n')
  const doc = parseDoc(markdown, 'Fees and limits')

  it('gives every heading a stable id and suffixes repeats', () => {
    // #given a page with two "Fees" sections
    // #then the second one gets its own id, so both can be linked
    assert.deepEqual(
      doc.headings.map((heading) => [heading.id, heading.depth]),
      [
        ['fees', 2],
        ['network-fees', 3],
        ['fees-1', 2],
      ],
    )
    assert.match(doc.html, /<h2 id="fees">Fees<\/h2>/)
    assert.match(doc.html, /<h2 id="fees-1">Fees<\/h2>/)
  })

  it('opens external links in a new tab and keeps internal links in place', () => {
    assert.match(doc.html, /<a href="https:\/\/docs\.morpho\.org" target="_blank" rel="noopener noreferrer">Morpho<\/a>/)
    assert.match(doc.html, /<a href="\/docs\/aislerun-payments">savings<\/a>/)
  })

  it('wraps tables, renders notes, and escapes raw HTML', () => {
    // #given markdown with a table, a blockquote and a raw <script> tag
    // #then the table can scroll, the note is styled, and the script is shown as text
    assert.match(doc.html, /<div class="doc-table"><table>/)
    assert.match(doc.html, /<aside class="doc-note">/)
    assert.doesNotMatch(doc.html, /<script>/)
    assert.match(doc.html, /&lt;script&gt;/)
  })

  it('splits the page into an intro chunk and one chunk per ## or ### heading for search', () => {
    // #given a page whose second-level section has a third-level subsection
    // #then search sees each heading's own text separately
    assert.deepEqual(
      doc.chunks.map((chunk) => [chunk.id, chunk.heading]),
      [
        ['', 'Fees and limits'],
        ['fees', 'Fees'],
        ['network-fees', 'Network fees'],
        ['fees-1', 'Fees'],
      ],
    )
    const [, fees, networkFees] = doc.chunks
    assert.match(fees?.text ?? '', /AisleRun takes 10% of interest/)
    assert.doesNotMatch(fees?.text ?? '', /\]\(/, 'plain text drops link syntax')
    assert.match(fees?.markdown ?? '', /^AisleRun takes 10%/)
    assert.match(networkFees?.text ?? '', /Savings \| 10% of interest/)
  })

  it('keeps each section whole, subsections included, for fetch', () => {
    const fees = doc.sections.find((section) => section.id === 'fees')
    assert.equal(fees?.depth, 2)
    assert.match(fees?.markdown ?? '', /### Network fees/)
    assert.match(fees?.markdown ?? '', /fees are paid in MON/)
    assert.doesNotMatch(fees?.markdown ?? '', /forge test/, 'stops at the next ## heading')
    assert.equal(doc.sections.find((section) => section.id === 'network-fees')?.depth, 3)
  })

  it('keeps code in the plain text so commands are searchable', () => {
    assert.match(doc.text, /forge test/)
  })
})
