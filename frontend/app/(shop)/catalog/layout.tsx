import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Каталог',
  description:
    'Все товары Ojakh: хинкали, пельмени, блинчики, хлеб на закваске, торты и десерты. Заказ с доставкой по Нижнему Новгороду.',
  alternates: { canonical: '/catalog' },
  openGraph: {
    title: 'Каталог — Ojakh',
    description: 'Домашние хинкали, пельмени, блинчики, хлеб, торты и десерты с доставкой.',
    url: '/catalog',
    type: 'website',
  },
};

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
