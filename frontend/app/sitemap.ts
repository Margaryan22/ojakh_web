import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ojakh.whysargis.ru';
  const now = new Date();
  return [
    { url: `${base}/catalog`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/login`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ];
}
