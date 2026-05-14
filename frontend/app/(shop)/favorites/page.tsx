'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { ProductCard } from '@/components/products/product-card';
import { AddToCartDialog } from '@/components/products/add-to-cart-dialog';
import { useFavoritesStore } from '@/stores/favorites.store';
import { FadeIn } from '@/components/motion/fade-in';
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_OUT, DUR_BASE } from '@/components/motion/motion-presets';
import type { Product } from '@/types';

export default function FavoritesPage() {
  const items = useFavoritesStore((s) => s.items);
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-bold">Избранное</h1>
      </FadeIn>

      {items.length === 0 ? (
        <FadeIn delay={0.05}>
          <div className="text-center py-12 space-y-3">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">
              У вас пока нет избранных товаров
            </p>
          </div>
        </FadeIn>
      ) : (
        <StaggerContainer immediate className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence initial={false}>
            {items.map((product) => (
              <motion.div
                key={product.id}
                layout
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: DUR_BASE, ease: EASE_OUT }}
              >
                <StaggerItem>
                  <ProductCard
                    product={product}
                    onAdd={(p) => {
                      setDialogProduct(p);
                      setDialogOpen(true);
                    }}
                  />
                </StaggerItem>
              </motion.div>
            ))}
          </AnimatePresence>
        </StaggerContainer>
      )}

      <AddToCartDialog
        product={dialogProduct}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
