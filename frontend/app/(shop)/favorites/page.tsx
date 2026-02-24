'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { ProductCard } from '@/components/products/product-card';
import { AddToCartDialog } from '@/components/products/add-to-cart-dialog';
import { useFavoritesStore } from '@/stores/favorites.store';
import type { Product } from '@/types';

export default function FavoritesPage() {
  const items = useFavoritesStore((s) => s.items);
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Избранное</h1>

      {items.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">
            У вас пока нет избранных товаров
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={(p) => {
                setDialogProduct(p);
                setDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <AddToCartDialog
        product={dialogProduct}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
