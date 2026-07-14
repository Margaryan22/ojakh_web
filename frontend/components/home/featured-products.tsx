'use client';

import { useState } from 'react';
import { ProductCard } from '@/components/products/product-card';
import { AddToCartDialog } from '@/components/products/add-to-cart-dialog';
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger';
import type { Product } from '@/types';

// Сетка «популярное» на главной: данные приходят с сервера (SSR/ISR),
// интерактив (добавление в корзину) — клиентский.
export function FeaturedProducts({ products }: { products: Product[] }) {
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddClick = (product: Product) => {
    setDialogProduct(product);
    setDialogOpen(true);
  };

  return (
    <>
      <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => (
          <StaggerItem key={product.id}>
            <ProductCard product={product} onAdd={handleAddClick} />
          </StaggerItem>
        ))}
      </StaggerContainer>

      <AddToCartDialog
        product={dialogProduct}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
