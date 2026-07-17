import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Каталог — заказать домашнюю еду с доставкой',
  description:
    'Каталог «Оджах»: заказать хинкали, пельмени, блинчики, хлеб на закваске, торты и десерты с доставкой по Нижнему Новгороду. Всё готовим сами из свежих продуктов.',
  alternates: { canonical: '/catalog' },
  openGraph: {
    title: 'Каталог — Оджах',
    description:
      'Домашние хинкали, пельмени, блинчики, хлеб, торты и десерты. Заказ с доставкой по Нижнему Новгороду.',
    url: '/catalog',
    type: 'website',
  },
};

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
