import type { NextRequest } from 'next/server'
import { getAllDocs } from '../../../lib/docs/content'
import { searchDocs } from '../../../lib/docs/search'

const MAX_LIMIT = 20

export function GET(request: NextRequest): Response {
  const query = request.nextUrl.searchParams.get('q') ?? ''
  const requested = Number(request.nextUrl.searchParams.get('limit') ?? 8)
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : 8
  return Response.json(
    { query, results: searchDocs(getAllDocs(), query, limit) },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
