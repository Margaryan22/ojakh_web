import type { MetadataRoute } from 'next';
import { fetchAllProducts } from '@/lib/server-fetch';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ojakh.whysargis.ru';
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/catalog`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
  ];

  const products = await fetchAllProducts();
  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/catalog/${p.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: p.available ? 0.8 : 0.4,
  }));

  return [...staticRoutes, ...productRoutes];
}
