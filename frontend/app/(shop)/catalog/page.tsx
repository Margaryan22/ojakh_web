'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ProductCard } from '@/components/products/product-card';
import { AddToCartDialog } from '@/components/products/add-to-cart-dialog';
import { ProductGridSkeleton } from '@/components/products/product-grid-skeleton';
import { CategoryNav } from '@/components/products/category-nav';
import { FadeIn } from '@/components/motion/fade-in';
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/constants';
import type { Product, ProductCategory } from '@/types';

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
    return CATEGORY_ORDER
      .map((cat) => ({
        category: cat as ProductCategory,
        items: available.filter((p) => p.category === cat),
      }))
      .filter((g) => g.items.length > 0);
  }, [products]);

  const handleAddClick = (product: Product) => {
    setDialogProduct(product);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-bold">Каталог</h1>
        <p className="text-muted-foreground mt-1">Домашние полуфабрикаты, торты и десерты</p>
      </FadeIn>

      {isLoading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground">
          Не удалось загрузить каталог. Попробуйте позже.
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Пока нет доступных товаров
        </div>
      ) : (
        <>
          <CategoryNav categories={groups.map((g) => g.category)} />

          <div className="space-y-10">
            {groups.map(({ category, items }, i) => (
              <FadeIn key={category} delay={i * 0.05}>
                <section id={category} className="scroll-mt-32 space-y-3">
                  <h2 className="text-xl font-bold">
                    {CATEGORY_LABELS[category]}
                  </h2>
                  <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map((product) => (
                      <StaggerItem key={product.id}>
                        <ProductCard
                          product={product}
                          onAdd={handleAddClick}
                        />
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                </section>
              </FadeIn>
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
