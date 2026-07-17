import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/components/layout/query-provider';
import { AuthProvider } from '@/components/layout/auth-provider';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ojakh.whysargis.ru';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Оджах — заказать домашнюю армянскую еду с доставкой в Нижнем Новгороде',
    template: '%s | Оджах',
  },
  description:
    'Оджах (Ojakh) — заказать домашние хинкали, пельмени, блинчики, хлеб на закваске, десерты и торты с доставкой по Нижнему Новгороду. Армянская домашняя кухня, готовим как для своих.',
  keywords: [
    'оджах',
    'оджах заказать',
    'оджах нижний новгород',
    'оджах доставка',
    'оджах еда',
    'ojakh',
    'ojakh нижний новгород',
    'армянская кухня нижний новгород',
    'армянская еда заказать',
    'хинкали нижний новгород',
    'хинкали заказать',
    'домашние полуфабрикаты нижний новгород',
    'торты на заказ нижний новгород',
    'пельмени домашние заказать',
    'блинчики домашние',
    'хлеб на закваске нижний новгород',
    'доставка домашней еды нижний новгород',
  ],
  // Картинки для OG/Twitter не задаём явно: Next подставляет
  // app/opengraph-image.png (1200×630) для обоих автоматически.
  openGraph: {
    title: 'Оджах — домашняя армянская еда и торты на заказ',
    description:
      'Домашние хинкали, пельмени, блинчики, хлеб, торты и десерты. Заказ с доставкой по Нижнему Новгороду.',
    url: SITE_URL,
    siteName: 'Оджах',
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Оджах — домашняя армянская еда и торты на заказ',
    description: 'Домашние полуфабрикаты и торты. Заказ с доставкой по Нижнему Новгороду.',
  },
  robots: { index: true, follow: true },
  // Каноникал задаётся на каждой индексируемой странице отдельно —
  // здесь его нет, иначе все страницы унаследуют канонику главной.
  verification: {
    ...(process.env.NEXT_PUBLIC_YANDEX_VERIFICATION
      ? { yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION }
      : {}),
    ...(process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION }
      : {}),
  },
};

// Локальный бизнес: кириллическое имя — основное (так ищут «оджах заказать»),
// латиница — в alternateName. Схема даёт сниппет с адресом/телефоном в выдаче.
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FoodEstablishment',
  '@id': `${SITE_URL}/#organization`,
  name: 'Оджах',
  alternateName: ['Ojakh', 'Ожах', 'Оджах Нижний Новгород'],
  description:
    'Армянская домашняя кухня: хинкали, пельмени, блинчики, хлеб на закваске, торты и десерты на заказ с доставкой по Нижнему Новгороду',
  url: SITE_URL,
  image: `${SITE_URL}/logo-light.jpg`,
  logo: `${SITE_URL}/icon-512.png`,
  telephone: '+7 904 059-23-03',
  email: 'sargismargaryan0605@gmail.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'ул. Мельникова, 29А',
    addressLocality: 'Нижний Новгород',
    postalCode: '603053',
    addressCountry: 'RU',
  },
  servesCuisine: ['Armenian', 'Georgian', 'Russian'],
  hasMenu: `${SITE_URL}/catalog`,
  priceRange: '₽₽',
  currenciesAccepted: 'RUB',
  paymentAccepted: 'Оплата картой онлайн',
  areaServed: {
    '@type': 'City',
    name: 'Нижний Новгород',
  },
  potentialAction: {
    '@type': 'OrderAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/catalog`,
      inLanguage: 'ru',
      actionPlatform: [
        'https://schema.org/DesktopWebPlatform',
        'https://schema.org/MobileWebPlatform',
      ],
    },
    deliveryMethod: ['https://schema.org/ParcelService', 'https://schema.org/OnSitePickup'],
  },
};

// WebSite-схема связывает кириллическое и латинское написание бренда
// и помогает поисковикам показывать сайт по запросу «оджах».
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: 'Оджах',
  alternateName: ['Ojakh', 'Оджах — армянская домашняя кухня'],
  url: SITE_URL,
  inLanguage: 'ru-RU',
  publisher: { '@id': `${SITE_URL}/#organization` },
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
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
