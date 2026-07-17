import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarClock, ChefHat, Truck } from 'lucide-react';
import { fetchAllProducts } from '@/lib/server-fetch';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/motion/fade-in';
import { FeaturedProducts } from '@/components/home/featured-products';
import { AraratRidge, Ornament } from '@/components/brand/ornament';

export const revalidate = 300;

export const metadata: Metadata = {
  // absolute — иначе корневой шаблон допишет второй «| Оджах»
  title: {
    absolute: 'Оджах — заказать армянскую домашнюю еду и торты с доставкой в Нижнем Новгороде',
  },
  description:
    'Оджах — армянская домашняя кухня в Нижнем Новгороде. Заказать хинкали, пельмени, блинчики, хлеб на закваске и торты с доставкой на дом. Готовим как для своих.',
  alternates: { canonical: '/' },
};

// FAQ: видимый текст и FAQPage-схема совпадают дословно — это условие
// показа расширенного сниппета в выдаче.
const faq = [
  {
    q: 'Как заказать еду в «Оджах»?',
    a: 'Выберите блюда в каталоге, добавьте их в корзину и оформите заказ, указав удобные дату и интервал доставки. Заказ готовится под вас, поэтому оформляйте минимум за 2 дня. Оплата — картой онлайн.',
  },
  {
    q: 'Сколько стоит доставка по Нижнему Новгороду?',
    a: 'Доставка стоит 300 ₽ в пределах 5 км от нашей кухни, дальше — плюс 50 ₽ за каждый километр. При заказе от 4000 ₽ доставка бесплатная. Также можно забрать заказ самовывозом (ул. Мельникова, 29А).',
  },
  {
    q: 'Можно ли заказать торт на день рождения или праздник?',
    a: 'Да, мы печём торты и десерты на заказ: медовик, наполеон и другие домашние торты. Выберите торт в каталоге и укажите дату — приготовим к нужному дню и привезём по Нижнему Новгороду.',
  },
  {
    q: 'Что означает «Оджах»?',
    a: '«Оджах» (ojakh) по-армянски значит «очаг». Мы готовим домашнюю армянскую еду — хинкали и пельмени ручной лепки, блинчики, хлеб на закваске — так, как готовят дома, для своих.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

const steps = [
  {
    icon: ChefHat,
    title: 'Выберите блюда',
    text: 'Домашние полуфабрикаты, выпечка и торты — всё готовим сами из свежих продуктов.',
  },
  {
    icon: CalendarClock,
    title: 'Укажите дату',
    text: 'Заказ готовится под вас: выберите удобные день и интервал доставки от 2 дней.',
  },
  {
    icon: Truck,
    title: 'Получите заказ',
    text: 'Привезём по Нижнему Новгороду или заберите самовывозом со склада.',
  },
];

export default async function HomePage() {
  // Популярное: сначала товары с меткой «хит», добираем остальными.
  const all = await fetchAllProducts();
  const available = all.filter((p) => p.available);
  const featured = [
    ...available.filter((p) => p.label === 'hit'),
    ...available.filter((p) => p.label !== 'hit'),
  ].slice(0, 8);

  return (
    <div className="space-y-14 pb-6">
      {/* Hero «Арарат»: кремовый верх, винный хребет со строкой преимуществ */}
      <FadeIn>
        <section className="overflow-hidden rounded-3xl border border-gold/40 bg-background">
          <div className="px-6 pt-12 sm:px-12 sm:pt-16 text-center space-y-5">
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-primary">
              Армянская домашняя кухня · Нижний Новгород
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-balance">
              «Оджах» — по-армянски{' '}
              <span className="text-primary">очаг</span>
            </h1>
            <p className="max-w-2xl mx-auto text-muted-foreground sm:text-lg">
              Хинкали и пельмени ручной лепки, блинчики, хлеб на закваске и
              торты на заказ. Готовим как для своих и привозим по Нижнему
              Новгороду.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-8">
              <Button asChild size="lg">
                <Link href="/catalog" className="gap-2">
                  Открыть каталог
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-foreground/50 text-foreground hover:border-foreground"
              >
                <Link href="/catalog#торты">Торты на заказ</Link>
              </Button>
            </div>
          </div>
          {/* Хребет + сплошная винная полоса, чтобы текст читался на любой ширине */}
          <div>
            <AraratRidge className="block h-28 w-full text-primary sm:h-40" />
            <div className="-mt-px bg-primary px-4 pb-4 pt-1 sm:pb-6 sm:pt-2">
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] sm:text-sm font-semibold text-primary-foreground/90">
                <span>Ручная лепка</span>
                <Ornament className="h-3 w-3 shrink-0 text-gold sm:h-3.5 sm:w-3.5" />
                <span>Заказ под вашу дату — от 2 дней</span>
                <Ornament className="h-3 w-3 shrink-0 text-gold sm:h-3.5 sm:w-3.5" />
                <span>Доставка по Нижнему Новгороду</span>
              </div>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Популярное */}
      {featured.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-2xl font-bold">Популярное</h2>
            <Link
              href="/catalog"
              className="text-sm text-primary hover:underline shrink-0"
            >
              Весь каталог →
            </Link>
          </div>
          <FeaturedProducts products={featured} />
        </section>
      )}

      {/* Как заказать */}
      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-center">Как заказать</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <FadeIn key={title} delay={i * 0.08}>
              <div className="h-full rounded-2xl border bg-card p-6 space-y-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {text}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Частые вопросы */}
      <section className="space-y-5">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <h2 className="text-2xl font-bold text-center">Частые вопросы</h2>
        <div className="mx-auto max-w-3xl space-y-3">
          {faq.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-2xl border bg-card px-5 py-4 open:pb-5"
            >
              <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3">
                {q}
                <span className="text-primary transition-transform group-open:rotate-45 text-xl leading-none shrink-0">
                  +
                </span>
              </summary>
              <p className="pt-3 text-sm text-muted-foreground leading-relaxed">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
