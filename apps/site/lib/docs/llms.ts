// Adapted from Floatless (MIT). See apps/site/lib/docs/LICENSE-floatless.
import { docAsMarkdown, type Doc } from './content'
import { API_URL, DOC_SECTIONS, SITE_URL } from './manifest'

export const PRODUCT_SUMMARY =
  'AisleRun is a shopper test an AI agent can order. The agent pays for one browser run through PayBox (an x402 payment in USDC on Base), and AisleRun opens an authorized product page in Chromium on a 390 x 844 phone and a 1440 x 900 desktop, adds the item to the cart, opens checkout without submitting anything, and returns a pass, fail or inconclusive verdict per viewport with the recording, screenshots, a Playwright trace and the first step that broke.'

export function markdownUrl(slug: string): string {
  return `${SITE_URL}/docs/${slug}.md`
}

/** The llms.txt index described at https://llmstxt.org: a summary, then one linked list per docs section. */
export function buildLlmsTxt(docs: readonly Doc[]): string {
  const bySlug = new Map(docs.map((doc) => [doc.slug, doc]))
  const sections = DOC_SECTIONS.map((section) => {
    const lines = section.pages.flatMap((page) => {
      const doc = bySlug.get(page.slug)
      return doc ? [`- [${doc.title}](${markdownUrl(doc.slug)}): ${doc.description}`] : []
    })
    return `## ${section.title}\n\n${lines.join('\n')}`
  })
  return [
    '# AisleRun',
    `> ${PRODUCT_SUMMARY}`,
    `Every page below is plain Markdown. The same docs are on the web at ${SITE_URL}/docs and all in one file at ${SITE_URL}/llms-full.txt. The API is at ${API_URL}; an agent pays for a run by calling PayBox's use_service tool on ${API_URL}/v1/inspections.`,
    ...sections,
    `## Optional\n\n- [All docs in one file](${SITE_URL}/llms-full.txt): every page above, concatenated\n- [Published runs](${SITE_URL}/demo): the paid runs with recordings and settlements\n- [Service metadata](${API_URL}/v1/meta): live price, network and authorized stores as JSON`,
  ].join('\n\n') + '\n'
}

export function buildLlmsFullTxt(docs: readonly Doc[]): string {
  return [`# AisleRun documentation\n\n> ${PRODUCT_SUMMARY}\n`, ...docs.map(docAsMarkdown)].join('\n---\n\n')
}
