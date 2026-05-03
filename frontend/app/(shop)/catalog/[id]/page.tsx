'use client';

import { useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShoppingCart, Info, ChefHat, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { formatPrice } from '@/lib/format';
import { CATEGORY_EMOJI, CATEGORY_LABELS } from '@/lib/constants';
import { AddToCartDialog } from '@/components/products/add-to-cart-dialog';
import { NutritionInfo } from '@/components/products/nutrition-info';
import api from '@/lib/api';
import type { Product, ProductCategory } from '@/types';

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

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-10">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
        <p className="text-muted-foreground text-lg">Товар не найден</p>
        <Button variant="outline" onClick={() => router.push('/catalog')}>
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

  const categoryLabel = CATEGORY_LABELS[product.category as ProductCategory] ?? product.category;

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Back button */}
      <div className="mb-5">
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Каталог
        </Link>
      </div>

      {/* Hero image */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-muted to-accent mb-6 shadow-md">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-9xl">{emoji}</span>
          </div>
        )}
        {!product.available && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-semibold text-lg">Недоступен</span>
          </div>
        )}
      </div>

      {/* Product header */}
      <div className="space-y-3 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {categoryLabel}
            </p>
            <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-primary">{formatPrice(product.price)}</p>
            <p className="text-xs text-muted-foreground">/ {product.unit}</p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {product.flavor && (
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {product.flavor}
            </Badge>
          )}
          {product.size && (
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {product.size}
              {product.weightGrams ? ` · ${product.weightGrams} г` : ''}
            </Badge>
          )}
          {product.weightGrams && !product.size && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              {product.weightGrams} г
            </Badge>
          )}
        </div>
      </div>

      {/* Description block */}
      {product.description && (
        <>
          <div className="rounded-xl border bg-card p-4 space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Info className="h-4 w-4 text-primary" />
              Описание
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>
        </>
      )}

      {/* Ingredients block */}
      {product.ingredients && (
        <>
          <div className="rounded-xl border bg-card p-4 space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ChefHat className="h-4 w-4 text-primary" />
              Состав
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {product.ingredients}
            </p>
          </div>
        </>
      )}

      {/* Nutrition block */}
      <div className="rounded-xl border bg-card p-4 mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Flame className="h-4 w-4 text-primary" />
          Пищевая ценность
        </div>
        <NutritionInfo product={product} />
      </div>

      <Separator className="mb-6" />

      {/* Add to cart */}
      <Button
        size="lg"
        className="w-full h-12 text-base font-semibold gap-2"
        onClick={() => setDialogOpen(true)}
        disabled={!product.available}
      >
        <ShoppingCart className="h-5 w-5" />
        {product.available ? 'Добавить в корзину' : 'Недоступен'}
      </Button>

      <AddToCartDialog
        product={product}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
