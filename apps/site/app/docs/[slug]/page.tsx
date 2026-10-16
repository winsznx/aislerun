import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DocArticle } from '../../../components/docs/DocArticle'
import { getDoc } from '../../../lib/docs/content'
import { DOC_PAGES, INTRODUCTION_SLUG } from '../../../lib/docs/manifest'

export const dynamicParams = false

export function generateStaticParams(): { slug: string }[] {
  return DOC_PAGES.filter((page) => page.slug !== INTRODUCTION_SLUG).map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = DOC_PAGES.find((entry) => entry.slug === slug)
  if (!page) return {}
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path, types: { 'text/markdown': `/docs/${page.slug}.md` } },
    openGraph: { title: `${page.title} | AisleRun Docs`, description: page.description, url: page.url, type: 'article' },
  }
}

export default async function DocRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = slug === INTRODUCTION_SLUG ? undefined : getDoc(slug)
  if (!doc) notFound()
  return <DocArticle doc={doc} />
}
