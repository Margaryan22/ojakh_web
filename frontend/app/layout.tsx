import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/components/layout/query-provider';
import { AuthProvider } from '@/components/layout/auth-provider';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ojakh.whysargis.ru';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Ojakh — Домашние полуфабрикаты, торты и десерты',
    template: '%s | Ojakh',
  },
  description:
    'Заказ домашних хинкали, пельменей, блинчиков, хлеба на закваске, десертов и тортов в Нижнем Новгороде. Свежие продукты, доставка на дом.',
  keywords: [
    'ojakh',
    'ojakh нижний новгород',
    'хинкали нижний новгород',
    'домашние полуфабрикаты нижний новгород',
    'торты на заказ нижний новгород',
    'пельмени домашние',
    'блинчики домашние',
    'хлеб на закваске нижний новгород',
    'доставка домашней еды нижний новгород',
  ],
  // Картинки для OG/Twitter не задаём явно: Next подставляет
  // app/opengraph-image.tsx (1200×630) для обоих автоматически.
  openGraph: {
    title: 'Ojakh — Домашние полуфабрикаты, торты и десерты',
    description:
      'Домашние хинкали, пельмени, блинчики, хлеб, торты и десерты. Доставка по Нижнему Новгороду.',
    url: SITE_URL,
    siteName: 'Ojakh',
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ojakh — Домашние полуфабрикаты и торты',
    description: 'Домашние полуфабрикаты и торты с доставкой по Нижнему Новгороду.',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FoodEstablishment',
  name: 'Ojakh',
  description: 'Домашние полуфабрикаты, торты и десерты с доставкой по Нижнему Новгороду',
  url: SITE_URL,
  image: `${SITE_URL}/logo-light.jpg`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'ул. Мельникова, 29А',
    addressLocality: 'Нижний Новгород',
    addressCountry: 'RU',
  },
  servesCuisine: ['Georgian', 'Russian'],
  hasMenu: `${SITE_URL}/catalog`,
  priceRange: '₽₽',
  areaServed: {
    '@type': 'City',
    name: 'Нижний Новгород',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-background antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
