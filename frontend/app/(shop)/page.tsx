import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarClock, ChefHat, Truck } from 'lucide-react';
import { fetchAllProducts } from '@/lib/server-fetch';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/motion/fade-in';
import { FeaturedProducts } from '@/components/home/featured-products';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Оджах — армянская домашняя кухня и торты на заказ в Нижнем Новгороде',
  description:
    'Домашние хинкали, пельмени, блинчики, хлеб на закваске и торты на заказ. Готовим как для своих — доставка по Нижнему Новгороду.',
  alternates: { canonical: '/' },
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
      {/* Hero */}
      <FadeIn>
        <section className="rounded-3xl bg-gradient-to-br from-primary/15 via-background to-primary/5 border px-6 py-12 sm:px-12 sm:py-16 text-center space-y-5">
          <p className="text-4xl">🫓</p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Оджах — армянская домашняя кухня
          </h1>
          <p className="max-w-2xl mx-auto text-muted-foreground sm:text-lg">
            Хинкали и пельмени ручной лепки, блинчики, хлеб на закваске и торты
            на заказ. Готовим как для своих и привозим по Нижнему Новгороду.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/catalog" className="gap-2">
                Открыть каталог
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/catalog#торты">Торты на заказ</Link>
            </Button>
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
    </div>
  );
}
