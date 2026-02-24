'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductCard } from '@/components/products/product-card';
import { AddToCartDialog } from '@/components/products/add-to-cart-dialog';
import { ProductGridSkeleton } from '@/components/products/product-grid-skeleton';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/constants';
import type { Product, ProductCategory } from '@/types';

export default function CatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: products = [], isLoading, error } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get('/products');
      return data;
    },
  });

  const filteredProducts =
    selectedCategory === 'all'
      ? products.filter((p) => p.available)
      : products.filter((p) => p.category === selectedCategory && p.available);

  const handleAddClick = (product: Product) => {
    setDialogProduct(product);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Каталог</h1>
        <p className="text-muted-foreground mt-1">Домашние полуфабрикаты, торты и десерты</p>
      </div>

      {/* Category tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4"
          >
            Все
          </TabsTrigger>
          {CATEGORY_ORDER.map((cat) => (
            <TabsTrigger
              key={cat}
              value={cat}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4"
            >
              {CATEGORY_LABELS[cat as ProductCategory]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Products grid */}
      {isLoading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground">
          Не удалось загрузить каталог. Попробуйте позже.
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          В этой категории пока нет товаров
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={handleAddClick}
            />
          ))}
        </div>
      )}

      {/* Add to cart dialog */}
      <AddToCartDialog
        product={dialogProduct}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
