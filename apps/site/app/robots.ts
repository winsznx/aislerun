import type { MetadataRoute } from 'next'
import { SITE_URL } from '../lib/docs/manifest'

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/runs/'] }], sitemap: `${SITE_URL}/sitemap.xml` }
}
