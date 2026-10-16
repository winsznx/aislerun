import { INTRODUCTION_SLUG } from './manifest'
import type { DocChunk, DocSection } from './markdown'

export interface SearchableDoc {
  slug: string
  title: string
  url: string
  chunks: readonly DocChunk[]
}

export interface FetchableDoc extends SearchableDoc {
  sections: readonly DocSection[]
}

export interface SearchResult {
  /** `slug` for a page's opening text, `slug#heading-id` for a section. Accepted by `findDocTarget`. */
  id: string
  title: string
  url: string
  snippet: string
  score: number
}

export const MAX_QUERY_LENGTH = 200

const STOP_WORDS = new Set(
  'a about an and are as at be by can do does for from has have how i if in is it its me my of on or that the their there this to was what when where which who why will with you your'.split(' '),
)
const SNIPPET_BEFORE = 80
const SNIPPET_AFTER = 180
const MAX_RESULTS_PER_PAGE = 2

export function searchDocs(docs: readonly SearchableDoc[], query: string, limit = 8): SearchResult[] {
  const normalizedQuery = query.slice(0, MAX_QUERY_LENGTH).toLowerCase().trim()
  const terms = queryTerms(normalizedQuery)
  if (terms.length === 0) return []

  const scored = docs.flatMap((doc) =>
    doc.chunks.map((chunk) => ({ doc, chunk, score: scoreChunk(doc, chunk, terms, normalizedQuery) })),
  )
  const perPage = new Map<string, number>()
  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter((entry) => {
      const count = perPage.get(entry.doc.slug) ?? 0
      perPage.set(entry.doc.slug, count + 1)
      return count < MAX_RESULTS_PER_PAGE
    })
    .slice(0, limit)
    .map(({ doc, chunk, score }) => ({
      id: chunk.id ? `${doc.slug}#${chunk.id}` : doc.slug,
      title: chunk.id ? `${doc.title}: ${chunk.heading}` : doc.title,
      url: chunk.id ? `${doc.url}#${chunk.id}` : doc.url,
      snippet: snippet(chunk.text, terms),
      score: Math.round(score * 100) / 100,
    }))
}

/** Resolves a search result id, a docs path or a full docs URL to the page and, when given, the whole section under that heading. */
export function findDocTarget<T extends FetchableDoc>(docs: readonly T[], id: string): { doc: T; section?: DocSection } | undefined {
  const [slug, sectionId] = id
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?docs\/?/, '')
    .replace(/\.md(?=#|$)/, '')
    .split('#')
  const doc = docs.find((entry) => entry.slug === (slug || INTRODUCTION_SLUG))
  if (!doc) return undefined
  if (!sectionId) return { doc }
  const section = doc.sections.find((entry) => entry.id === sectionId)
  return section ? { doc, section } : undefined
}

function queryTerms(query: string): string[] {
  const words = query.split(/[^a-z0-9]+/).filter((word) => word.length > 1)
  const meaningful = words.filter((word) => !STOP_WORDS.has(word))
  return [...new Set(meaningful.length > 0 ? meaningful : words)]
}

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

const SUFFIXES = ['ations', 'ation', 'ments', 'ment', 'ings', 'ing', 'ions', 'ion', 'ers', 'er', 'ies', 'es', 'ed', 's']

/** Strips one common English ending so "authentication" and "authenticated" share a stem. */
function stem(word: string): string {
  const suffix = SUFFIXES.find((ending) => word.endsWith(ending) && word.length - ending.length >= 4)
  return suffix ? word.slice(0, -suffix.length) : word
}

const INFLECTIONS = ['s', 'es', 'd', 'ed', 'er', 'al', 'ing']

/**
 * How well a word in the docs matches a query term: 1 for the same word, 0.8 for an inflection ("fee" and "fees"),
 * 0.6 for a longer word that starts with the term ("withdraw" and "withdrawals"), 0.5 for a shared stem.
 * Different names that only share letters, like AUSD and aUSDC, don't match.
 */
function matchWeight(word: string, term: string): number {
  if (word === term) return 1
  const [shorter, longer] = word.length < term.length ? [word, term] : [term, word]
  if (shorter.length >= 3 && longer.startsWith(shorter) && INFLECTIONS.includes(longer.slice(shorter.length))) return 0.8
  if (term.length >= 5 && word.startsWith(term)) return 0.6
  const termStem = stem(term)
  return termStem.length >= 5 && stem(word).startsWith(termStem) ? 0.5 : 0
}

function scoreChunk(doc: SearchableDoc, chunk: DocChunk, terms: string[], phrase: string): number {
  const titleWords = words(`${doc.title} ${chunk.heading}`)
  const bodyWords = words(chunk.text)
  let score = 0
  let found = 0
  for (const term of terms) {
    const inTitle = Math.max(0, ...titleWords.map((word) => matchWeight(word, term)))
    const inBody = bodyWords.reduce((sum, word) => sum + matchWeight(word, term), 0)
    if (inTitle > 0 || inBody > 0) found += 1
    score += inTitle * 8 + Math.log2(1 + inBody) * 2
  }
  if (found === 0) return 0
  const coverage = found / terms.length
  const phraseBonus = terms.length > 1 && chunk.text.toLowerCase().includes(phrase) ? 6 : 0
  return (score + phraseBonus) * coverage * coverage
}

function snippet(text: string, terms: string[]): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const lower = flat.toLowerCase()
  const hits = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0)
  const center = hits.length > 0 ? Math.min(...hits) : 0
  const start = Math.max(0, center - SNIPPET_BEFORE)
  const end = Math.min(flat.length, center + SNIPPET_AFTER)
  const startAtWord = start === 0 ? 0 : flat.indexOf(' ', start) + 1
  const endAtWord = end === flat.length ? end : Math.max(flat.lastIndexOf(' ', end), startAtWord)
  return `${startAtWord > 0 ? '…' : ''}${flat.slice(startAtWord, endAtWord).trim()}${endAtWord < flat.length ? '…' : ''}`
}
