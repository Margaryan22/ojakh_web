'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ProductCard } from '@/components/products/product-card';
import { AddToCartDialog } from '@/components/products/add-to-cart-dialog';
import { ProductGridSkeleton } from '@/components/products/product-grid-skeleton';
import { CategoryNav } from '@/components/products/category-nav';
import { GoldDivider } from '@/components/editorial/gold-divider';
import { EditorialNumber } from '@/components/editorial/editorial-number';
import { Reveal } from '@/components/editorial/reveal';
import { Stagger, StaggerItem } from '@/components/editorial/stagger';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/constants';
import type { Product, ProductCategory } from '@/types';

const CATEGORY_DESCRIPTORS: Record<ProductCategory, string> = {
  'хинкали': 'Тбилисский рецепт',
  'пельмени': 'Сибирские и домашние',
  'блинчики': 'С разной начинкой',
  'хлеб': 'На закваске',
  'десерты': 'Без консервантов',
  'торты': 'По предзаказу за 2 дня',
};

export default function CatalogPage() {
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: products = [], isLoading, error } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get('/products');
      return data;
    },
  });

  const groups = useMemo(() => {
    const available = products.filter((p) => p.available);
    return CATEGORY_ORDER.map((cat) => ({
      category: cat as ProductCategory,
      items: available.filter((p) => p.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [products]);

  const handleAddClick = (product: Product) => {
    setDialogProduct(product);
    setDialogOpen(true);
  };

  return (
    <div className='space-y-10'>
      <Reveal>
        <div className='flex flex-col gap-6 pt-4 pb-2'>
          <span className='font-mono text-xs uppercase tracking-[0.3em] text-gold'>
            № 01 — Каталог
          </span>
          <h1 className='font-display text-5xl md:text-7xl leading-none tracking-tight'>
            Что у&nbsp;нас <em>сегодня</em>
          </h1>
          <p className='font-display italic text-lg md:text-xl text-muted-foreground max-w-xl'>
            Домашние полуфабрикаты, хлеб на&nbsp;закваске, торты и&nbsp;десерты&nbsp;— из&nbsp;нашей кухни в&nbsp;вашу.
          </p>
          <GoldDivider align='left' />
        </div>
      </Reveal>

      {isLoading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <div className='text-center py-20 text-muted-foreground font-display italic'>
          Не удалось загрузить каталог. Попробуйте позже.
        </div>
      ) : groups.length === 0 ? (
        <div className='text-center py-20 text-muted-foreground font-display italic'>
          Пока нет доступных товаров
        </div>
      ) : (
        <>
          <CategoryNav categories={groups.map((g) => g.category)} />

          <div className='space-y-24 md:space-y-32 pt-4'>
            {groups.map(({ category, items }, sectionIndex) => (
              <section
                key={category}
                id={category}
                className='scroll-mt-32 space-y-8'
              >
                <div className='flex items-end justify-between gap-6 border-b border-gold/40 pb-6'>
                  <div className='flex items-end gap-5 md:gap-7'>
                    <EditorialNumber size='lg' className='hidden sm:inline-block'>
                      0{sectionIndex + 1}
                    </EditorialNumber>
                    <div className='space-y-2'>
                      <span className='font-mono text-[10px] uppercase tracking-[0.3em] text-gold sm:hidden'>
                        0{sectionIndex + 1}
                      </span>
                      <h2 className='font-display text-3xl md:text-5xl leading-none capitalize'>
                        {CATEGORY_LABELS[category]}
                      </h2>
                    </div>
                  </div>
                  <p className='hidden md:block font-display italic text-base text-muted-foreground text-right max-w-xs'>
                    {CATEGORY_DESCRIPTORS[category]}
                  </p>
                </div>

                <Stagger
                  disableInitial={sectionIndex === 0}
                  className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10'
                >
                  {items.map((product) => (
                    <StaggerItem key={product.id}>
                      <ProductCard product={product} onAdd={handleAddClick} />
                    </StaggerItem>
                  ))}
                </Stagger>
              </section>
            ))}
          </div>
        </>
      )}

      <AddToCartDialog
        product={dialogProduct}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
