import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchProduct } from '@/lib/server-fetch';
import { CATEGORY_LABELS } from '@/lib/constants';
import type { ProductCategory } from '@/types';
import { ProductDetail } from './product-detail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ojakh.whysargis.ru';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function absoluteImage(imageUrl?: string): string | undefined {
  if (!imageUrl) return undefined;
  return imageUrl.startsWith('/') ? `${API_URL}${imageUrl}` : imageUrl;
}

function categoryOf(category: string): string {
  return CATEGORY_LABELS[category as ProductCategory] ?? category;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProduct(id);

  if (!product) {
    return { title: 'Товар не найден', robots: { index: false, follow: true } };
  }

  const categoryLabel = categoryOf(product.category);
  const title = `${product.name} — заказать в Нижнем Новгороде | Ojakh`;
  const description = product.description
    ? `${product.description} Заказ с доставкой по Нижнему Новгороду — Ojakh.`
    : `${product.name} (${categoryLabel}) — заказать с доставкой по Нижнему Новгороду. Домашнее качество от Ojakh.`;
  const image = absoluteImage(product.imageUrl);
  const url = `${SITE_URL}/catalog/${product.id}`;

  return {
    title,
    description,
    alternates: { canonical: `/catalog/${product.id}` },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Ojakh',
      locale: 'ru_RU',
      type: 'website',
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await fetchProduct(id);

  if (!product) notFound();

  const categoryLabel = categoryOf(product.category);
  const image = absoluteImage(product.imageUrl);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || `${product.name} — ${categoryLabel} от Ojakh`,
    ...(image ? { image: [image] } : {}),
    category: categoryLabel,
    brand: { '@type': 'Brand', name: 'Ojakh' },
    offers: {
      '@type': 'Offer',
      price: (product.price / 100).toFixed(2),
      priceCurrency: 'RUB',
      availability: product.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/catalog/${product.id}`,
      seller: { '@type': 'Organization', name: 'Ojakh' },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetail id={id} initialProduct={product} />
    </>
  );
}
