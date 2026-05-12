'use client';

import Image from 'next/image';
import { motion } from 'motion/react';
import { Plus, Heart } from 'lucide-react';
import { Magnetic } from '@/components/editorial/magnetic';
import { ViewTransitionLink } from '@/components/editorial/view-transition-link';
import { formatPrice } from '@/lib/format';
import { CATEGORY_EMOJI } from '@/lib/constants';
import { useFavoritesStore } from '@/stores/favorites.store';
import { useCartStore } from '@/stores/cart.store';
import { cn } from '@/lib/utils';
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
  const unitLabel = product.unit === 'кг' ? 'кг' : 'шт';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const imageUrl = product.imageUrl?.startsWith('/')
    ? `${apiUrl}${product.imageUrl}`
    : product.imageUrl;

  return (
    <article className='group relative flex flex-col'>
      {/* Image */}
      <ViewTransitionLink
        href={`/catalog/${product.id}`}
        className='block relative aspect-[4/5] bg-sand overflow-hidden border border-transparent group-hover:border-gold transition-colors duration-500'
      >
        {/* Cart badge */}
        {inCartQty > 0 && (
          <span className='absolute top-3 left-3 z-10 flex h-6 min-w-6 px-1.5 items-center justify-center rounded-full border border-gold bg-background font-mono text-[10px] text-gold tabular-nums'>
            {inCartQty}
          </span>
        )}

        {/* Favorite */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(product);
          }}
          className='absolute top-3 right-3 z-10 p-1.5 hover:scale-110 transition-transform cursor-pointer'
          aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
        >
          <Heart
            className={cn(
              'h-5 w-5 transition-colors',
              isFavorite
                ? 'fill-gold text-gold'
                : 'text-foreground/70 hover:text-gold',
            )}
            strokeWidth={1.25}
          />
        </button>

        <motion.div
          className='absolute inset-0'
          whileHover={{ scale: 1.04 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
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
              sizes='(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
            />
          ) : (
            <span className='absolute inset-0 flex items-center justify-center text-7xl opacity-80'>
              {emoji}
            </span>
          )}
        </motion.div>
      </ViewTransitionLink>

      {/* Copy */}
      <div className='pt-5 pb-2 space-y-3'>
        <ViewTransitionLink
          href={`/catalog/${product.id}`}
          className='block relative'
        >
          <h3 className='font-display text-lg leading-snug line-clamp-2 text-foreground transition-colors group-hover:text-primary'>
            {product.name}
          </h3>
          <span
            className='block h-px w-0 bg-gold transition-all duration-500 group-hover:w-full mt-1'
            aria-hidden
          />
        </ViewTransitionLink>

        {(product.flavor || product.size) && (
          <div className='flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
            {product.flavor && <span>{product.flavor}</span>}
            {product.flavor && product.size && <span>·</span>}
            {product.size && (
              <span>
                {product.size}
                {product.weightGrams ? ` (${product.weightGrams} г)` : ''}
              </span>
            )}
          </div>
        )}

        <div className='flex items-end justify-between gap-3 pt-1'>
          <p className='flex items-baseline gap-1.5'>
            <span className='font-display italic text-xl text-primary'>
              {formatPrice(product.price)}
            </span>
            <span className='font-mono text-[10px] text-muted-foreground'>
              · {unitLabel}
            </span>
          </p>

          <Magnetic strength={0.18}>
            <button
              onClick={() => onAdd(product)}
              disabled={!product.available}
              aria-label='Добавить в корзину'
              className='inline-flex h-9 w-9 items-center justify-center border border-gold/60 hover:border-foreground hover:bg-gold/10 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'
            >
              <Plus className='h-4 w-4' strokeWidth={1.25} />
            </button>
          </Magnetic>
        </div>
      </div>
    </article>
  );
}
