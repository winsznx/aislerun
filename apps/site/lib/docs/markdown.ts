// Adapted from Floatless (MIT). See apps/site/lib/docs/LICENSE-floatless.
import { Marked, Renderer, walkTokens, type Token, type Tokens } from 'marked'
import { SITE_URL } from './manifest'

export interface DocHeading {
  id: string
  text: string
  depth: number
}

/** The text under one `##` or `###` heading up to the next one, the unit search ranks. */
export interface DocChunk {
  /** Heading id, or '' for the text before the first heading. */
  id: string
  heading: string
  markdown: string
  text: string
}

/** A `##` or `###` heading with everything under it, including its subsections. What `fetch` returns for a section id. */
export interface DocSection {
  id: string
  heading: string
  depth: number
  markdown: string
}

export interface ParsedDoc {
  html: string
  headings: DocHeading[]
  chunks: DocChunk[]
  sections: DocSection[]
  text: string
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseDoc(markdown: string, title: string): ParsedDoc {
  const tokens = new Marked({ gfm: true }).lexer(markdown)
  const ids = assignHeadingIds(tokens)
  const html = createRenderer(ids).parser(tokens)
  const headings = collectHeadings(tokens, ids)
  const chunks = splitChunks(tokens, ids, title)
  const sections = collectSections(tokens, ids)
  return { html, headings, chunks, sections, text: chunks.map((chunk) => chunk.text).join('\n\n') }
}

function isSectionHeading(token: Token): token is Tokens.Heading {
  return token.type === 'heading' && ((token as Tokens.Heading).depth === 2 || (token as Tokens.Heading).depth === 3)
}

/** Ids follow document order, so a repeated heading gets `-1`, `-2` suffixes like GitHub's. */
function assignHeadingIds(tokens: Token[]): WeakMap<Token, string> {
  const ids = new WeakMap<Token, string>()
  const used = new Map<string, number>()
  walkTokens(tokens, (token) => {
    if (token.type !== 'heading') return
    const base = slugifyHeading(inlineText((token as Tokens.Heading).tokens)) || 'section'
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    ids.set(token, seen === 0 ? base : `${base}-${seen}`)
  })
  return ids
}

function collectHeadings(tokens: Token[], ids: WeakMap<Token, string>): DocHeading[] {
  return tokens.filter(isSectionHeading).map((heading) => ({ id: ids.get(heading) ?? '', text: inlineText(heading.tokens), depth: heading.depth }))
}

function splitChunks(tokens: Token[], ids: WeakMap<Token, string>, title: string): DocChunk[] {
  let current = { id: '', heading: title, tokens: [] as Token[] }
  const chunks = [current]
  for (const token of tokens) {
    if (isSectionHeading(token)) {
      current = { id: ids.get(token) ?? '', heading: inlineText(token.tokens), tokens: [] }
      chunks.push(current)
      continue
    }
    current.tokens.push(token)
  }
  return chunks
    .map((chunk) => ({
      id: chunk.id,
      heading: chunk.heading,
      markdown: chunk.tokens.map((token) => token.raw).join('').trim(),
      text: blockText(chunk.tokens).trim(),
    }))
    .filter((chunk) => chunk.text.length > 0)
}

function collectSections(tokens: Token[], ids: WeakMap<Token, string>): DocSection[] {
  return tokens.flatMap((token, index) => {
    if (!isSectionHeading(token)) return []
    const end = tokens.findIndex((next, nextIndex) => nextIndex > index && isSectionHeading(next) && next.depth <= token.depth)
    const body = tokens.slice(index + 1, end === -1 ? tokens.length : end)
    return [{ id: ids.get(token) ?? '', heading: inlineText(token.tokens), depth: token.depth, markdown: body.map((part) => part.raw).join('').trim() }]
  })
}

function createRenderer(ids: WeakMap<Token, string>): Marked {
  const base = new Renderer()
  return new Marked({
    gfm: true,
    renderer: {
      heading(token) {
        const id = ids.get(token)
        const attribute = id ? ` id="${id}"` : ''
        return `<h${token.depth}${attribute}>${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens)
        if (/^\s*(javascript|data|vbscript):/i.test(href)) return text
        const titleAttribute = title ? ` title="${escapeHtml(title)}"` : ''
        const external = /^https?:\/\//i.test(href) && !href.startsWith(SITE_URL)
        const targetAttributes = external ? ' target="_blank" rel="noopener noreferrer"' : ''
        return `<a href="${escapeHtml(href)}"${titleAttribute}${targetAttributes}>${text}</a>`
      },
      table(token) {
        return `<div class="doc-table">${base.table.call(this, token)}</div>\n`
      },
      blockquote({ tokens }) {
        return `<aside class="doc-note">${this.parser.parse(tokens)}</aside>\n`
      },
      html({ text }) {
        return escapeHtml(text)
      },
    },
  })
}

function inlineText(tokens: readonly Token[] | undefined): string {
  if (!tokens) return ''
  return tokens
    .map((token) => {
      if ('tokens' in token && Array.isArray(token.tokens)) return inlineText(token.tokens)
      if (token.type === 'br') return ' '
      if (token.type === 'html') return ''
      return 'text' in token && typeof token.text === 'string' ? token.text : ''
    })
    .join('')
}

function blockText(tokens: readonly Token[]): string {
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'heading':
        case 'paragraph':
          return `${inlineText((token as Tokens.Heading | Tokens.Paragraph).tokens)}\n`
        case 'text':
          return `${'tokens' in token && token.tokens ? inlineText(token.tokens) : (token as Tokens.Text).text}\n`
        case 'list':
          return (token as Tokens.List).items.map((item) => `- ${blockText(item.tokens).trim()}`).join('\n') + '\n'
        case 'table': {
          const table = token as Tokens.Table
          const row = (cells: Tokens.TableCell[]) => cells.map((cell) => inlineText(cell.tokens)).join(' | ')
          return [row(table.header), ...table.rows.map(row)].join('\n') + '\n'
        }
        case 'blockquote':
          return blockText((token as Tokens.Blockquote).tokens)
        case 'code':
          return `${(token as Tokens.Code).text}\n`
        default:
          return ''
      }
    })
    .join('\n')
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
