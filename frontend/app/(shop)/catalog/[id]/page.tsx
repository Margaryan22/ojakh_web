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
  // Без «| Оджах» — суффикс добавит шаблон из корневого layout.
  const title = `${product.name} — заказать в Нижнем Новгороде`;
  const description = product.description
    ? `${product.description} Заказ с доставкой по Нижнему Новгороду — «Оджах».`
    : `${product.name} (${categoryLabel}) — заказать с доставкой по Нижнему Новгороду. Домашнее качество от «Оджах».`;
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
      siteName: 'Оджах',
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
    description: product.description || `${product.name} — ${categoryLabel} от «Оджах»`,
    ...(image ? { image: [image] } : {}),
    category: categoryLabel,
    brand: { '@type': 'Brand', name: 'Оджах', alternateName: 'Ojakh' },
    offers: {
      '@type': 'Offer',
      price: (product.price / 100).toFixed(2),
      priceCurrency: 'RUB',
      availability: product.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/catalog/${product.id}`,
      seller: { '@id': `${SITE_URL}/#organization` },
    },
  };

  // Хлебные крошки в выдаче: Главная → Каталог → товар.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Каталог', item: `${SITE_URL}/catalog` },
      { '@type': 'ListItem', position: 3, name: product.name },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ProductDetail id={id} initialProduct={product} />
    </>
  );
}
