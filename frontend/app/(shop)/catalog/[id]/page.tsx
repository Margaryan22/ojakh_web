'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GoldDivider } from '@/components/editorial/gold-divider';
import { Reveal } from '@/components/editorial/reveal';
import { Magnetic } from '@/components/editorial/magnetic';
import { formatPrice } from '@/lib/format';
import { CATEGORY_EMOJI, CATEGORY_LABELS } from '@/lib/constants';
import { AddToCartDialog } from '@/components/products/add-to-cart-dialog';
import { NutritionInfo } from '@/components/products/nutrition-info';
import { StarRating } from '@/components/reviews/star-rating';
import { ReviewList } from '@/components/reviews/review-list';
import api from '@/lib/api';
import type { Product, ProductCategory, ReviewSummary } from '@/types';

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: product, isLoading, isError } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data } = await api.get(`/products/${id}`);
      return data;
    },
  });

  const { data: summary } = useQuery<ReviewSummary>({
    queryKey: ['reviews-summary', id],
    queryFn: async () => {
      const { data } = await api.get(`/products/${id}/reviews/summary`);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className='max-w-5xl mx-auto space-y-6 pb-10'>
        <Skeleton className='h-8 w-32' />
        <div className='grid md:grid-cols-2 gap-12'>
          <Skeleton className='aspect-[4/5] w-full rounded-none' />
          <div className='space-y-4'>
            <Skeleton className='h-12 w-3/4' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-2/3' />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className='max-w-2xl mx-auto text-center py-20 space-y-4'>
        <p className='text-muted-foreground font-display italic text-lg'>
          Товар не найден
        </p>
        <Button variant='outline' onClick={() => router.push('/catalog')}>
          Вернуться в каталог
        </Button>
      </div>
    );
  }

  const emoji = CATEGORY_EMOJI[product.category as ProductCategory] ?? '🍽️';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const imageUrl = product.imageUrl?.startsWith('/')
    ? `${apiUrl}${product.imageUrl}`
    : product.imageUrl;

  const categoryLabel =
    CATEGORY_LABELS[product.category as ProductCategory] ?? product.category;

  return (
    <Reveal>
      <div className='max-w-5xl mx-auto pb-16'>
        {/* Back link */}
        <div className='mb-10'>
          <Link
            href='/catalog'
            className='inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors'
          >
            <ArrowLeft className='h-3.5 w-3.5' strokeWidth={1.5} />
            Каталог
          </Link>
        </div>

        <div className='grid md:grid-cols-2 gap-10 md:gap-16'>
          {/* Image */}
          <div className='md:sticky md:top-28 md:self-start'>
            <div
              className='relative w-full aspect-[4/5] bg-sand overflow-hidden border border-gold/40'
              style={{
                viewTransitionName: `product-image-${product.id}`,
              } as React.CSSProperties}
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={product.name}
                  fill
                  className='object-cover'
                  sizes='(max-width: 768px) 100vw, 50vw'
                  priority
                />
              ) : (
                <div className='absolute inset-0 flex items-center justify-center'>
                  <span className='text-[12rem] opacity-80'>{emoji}</span>
                </div>
              )}
              {!product.available && (
                <div className='absolute inset-0 bg-foreground/50 flex items-center justify-center'>
                  <span className='font-display italic text-background text-2xl'>
                    Недоступен
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Copy */}
          <div className='space-y-8'>
            <div className='space-y-5'>
              <span className='font-mono text-[10px] uppercase tracking-[0.3em] text-gold'>
                {categoryLabel}
              </span>
              <h1 className='font-display text-4xl md:text-5xl leading-[1.05] tracking-tight'>
                {product.name}
              </h1>

              {summary && summary.count > 0 ? (
                <div className='flex items-center gap-2'>
                  <StarRating value={summary.average ?? 0} size='sm' />
                  <span className='font-mono text-xs text-foreground'>
                    {summary.average?.toFixed(1)}
                  </span>
                  <span className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                    · {summary.count}{' '}
                    {summary.count === 1
                      ? 'отзыв'
                      : summary.count < 5
                        ? 'отзыва'
                        : 'отзывов'}
                  </span>
                </div>
              ) : (
                <span className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                  Нет отзывов
                </span>
              )}
            </div>

            <GoldDivider align='left' />

            {/* Price */}
            <div className='flex items-baseline gap-3'>
              <p className='font-display italic text-4xl text-primary'>
                {formatPrice(product.price)}
              </p>
              <p className='font-mono text-xs text-muted-foreground'>
                / {product.unit}
              </p>
            </div>

            {/* Attributes */}
            {(product.flavor || product.size) && (
              <div className='flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                {product.flavor && <span>{product.flavor}</span>}
                {product.flavor && product.size && <span>·</span>}
                {product.size && (
                  <span>
                    {product.size}
                    {product.weightGrams ? ` · ${product.weightGrams} г` : ''}
                  </span>
                )}
                {product.weightGrams && !product.size && (
                  <span>{product.weightGrams} г</span>
                )}
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className='space-y-2 pt-2'>
                <p className='font-mono text-[10px] uppercase tracking-[0.25em] text-gold'>
                  Описание
                </p>
                <p className='text-base text-foreground/85 leading-relaxed'>
                  {product.description}
                </p>
              </div>
            )}

            {/* Ingredients */}
            {product.ingredients && (
              <div className='space-y-2'>
                <p className='font-mono text-[10px] uppercase tracking-[0.25em] text-gold'>
                  Состав
                </p>
                <p className='text-sm text-muted-foreground leading-relaxed'>
                  {product.ingredients}
                </p>
              </div>
            )}

            {/* Nutrition */}
            <div className='space-y-3'>
              <p className='font-mono text-[10px] uppercase tracking-[0.25em] text-gold'>
                Пищевая ценность
              </p>
              <NutritionInfo product={product} />
            </div>

            {/* CTA */}
            <div className='pt-4'>
              <Magnetic strength={0.15}>
                <button
                  onClick={() => setDialogOpen(true)}
                  disabled={!product.available}
                  className='group inline-flex w-full items-center justify-center gap-3 h-14 px-8 bg-foreground text-background font-display uppercase tracking-[0.2em] text-xs hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'
                >
                  <ShoppingCart className='h-4 w-4' strokeWidth={1.5} />
                  {product.available ? 'Добавить в корзину' : 'Недоступен'}
                </button>
              </Magnetic>
            </div>
          </div>
        </div>

        <AddToCartDialog
          product={product}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />

        {/* Reviews */}
        <section className='mt-24 md:mt-32 space-y-8'>
          <div className='space-y-4'>
            <span className='font-mono text-[10px] uppercase tracking-[0.3em] text-gold'>
              Отзывы
            </span>
            <h2 className='font-display text-3xl md:text-4xl'>
              Что говорят гости
            </h2>
            <GoldDivider align='left' />
          </div>
          <ReviewList productId={product.id} />
        </section>
      </div>
    </Reveal>
  );
}
