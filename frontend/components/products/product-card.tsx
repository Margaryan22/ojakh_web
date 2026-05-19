'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { CATEGORY_EMOJI } from '@/lib/constants';
import { PRODUCT_LABELS } from '@/lib/product-labels';
import { cn } from '@/lib/utils';
import { useFavoritesStore } from '@/stores/favorites.store';
import { useCartStore } from '@/stores/cart.store';
import { DUR_FAST, EASE_OUT } from '@/components/motion/motion-presets';
import type { Product, ProductCategory } from '@/types';


interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const isFavorite = useFavoritesStore((s) => s.has(product.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const getItemQuantity = useCartStore((s) => s.getItemQuantity);
  const inCartQty = getItemQuantity(product.id);

  const emoji = CATEGORY_EMOJI[product.category as ProductCategory] ?? '🍽️';
  const unitLabel = product.unit === 'кг' ? '/ кг' : '/ шт';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const imageUrl = product.imageUrl?.startsWith('/')
    ? `${apiUrl}${product.imageUrl}`
    : product.imageUrl;

  return (
    <Card className="group relative overflow-hidden transition-[transform,box-shadow] duration-300 ease-out-soft hover:shadow-lg hover:-translate-y-1">
      {/* Favorite button */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(product);
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.88 }}
        transition={{ duration: DUR_FAST, ease: EASE_OUT }}
        className="absolute top-2 right-2 z-10 rounded-full overflow-hidden w-10 h-10 shadow-md cursor-pointer"
        aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isFavorite ? 'on' : 'off'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR_FAST, ease: EASE_OUT }}
            className="block w-full h-full"
          >
            <Image
              src={isFavorite ? '/ornament-fav-off.jpg' : '/ornament-fav-on.jpg'}
              alt=""
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* Top-left badge stack: label + cart count */}
      <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
        {product.label && PRODUCT_LABELS[product.label] && (
          <Badge
            className={cn(
              'font-semibold text-[10px] uppercase tracking-wide shadow-md pointer-events-none',
              PRODUCT_LABELS[product.label].className,
            )}
          >
            {PRODUCT_LABELS[product.label].ru}
          </Badge>
        )}
        <AnimatePresence>
          {inCartQty > 0 && (
            <motion.div
              key={inCartQty}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              <Badge className="bg-primary text-primary-foreground shadow-md">
                {inCartQty} шт
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Image / Emoji — links to product detail page */}
      <Link href={`/catalog/${product.id}`} className="block">
        <div className="relative aspect-square bg-linear-to-br from-muted to-accent flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-600 ease-out-soft group-hover:scale-110"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <span className="text-6xl transition-transform duration-500 ease-out-soft group-hover:scale-110">{emoji}</span>
          )}
        </div>
      </Link>

      <CardContent className="p-4 space-y-2">
        <div>
          <Link href={`/catalog/${product.id}`}>
            <h3 className="font-bold text-base leading-tight line-clamp-2 text-foreground hover:text-primary transition-colors duration-200">{product.name}</h3>
          </Link>
          <div className="flex flex-wrap gap-1 mt-1">
            {product.flavor && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                {product.flavor}
              </Badge>
            )}
            {product.size && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                {product.size}
                {product.weightGrams ? ` (${product.weightGrams} г)` : ''}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <div>
            <span className="font-bold text-base text-primary">
              {formatPrice(product.price)}
            </span>
            <span className="text-muted-foreground font-normal text-xs ml-1">{unitLabel}</span>
          </div>
          <Button
            size="sm"
            className="h-9 w-9 p-0 rounded-full shadow-md hover:shadow-lg"
            onClick={() => onAdd(product)}
            disabled={!product.available}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
