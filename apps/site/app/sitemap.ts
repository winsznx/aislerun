import type { MetadataRoute } from 'next'
import { DOC_PAGES, INTRODUCTION_SLUG, SITE_URL } from '../lib/docs/manifest'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/demo`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/demo/compare`, changeFrequency: 'weekly', priority: 0.8 },
    ...DOC_PAGES.map((page) => ({ url: page.url, changeFrequency: 'weekly' as const, priority: page.slug === INTRODUCTION_SLUG ? 0.9 : 0.7 })),
  ]
}
