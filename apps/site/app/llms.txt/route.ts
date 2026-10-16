import { getAllDocs } from '../../lib/docs/content'
import { buildLlmsTxt } from '../../lib/docs/llms'

export const dynamic = 'force-static'

export function GET(): Response {
  return new Response(buildLlmsTxt(getAllDocs()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
