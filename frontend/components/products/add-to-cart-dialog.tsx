'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { CATEGORY_EMOJI } from '@/lib/constants';
import { useCartStore } from '@/stores/cart.store';
import { useAuthStore } from '@/stores/auth.store';
import type { Product, ProductCategory } from '@/types';

interface AddToCartDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToCartDialog({ product, open, onOpenChange }: AddToCartDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const user = useAuthStore((s) => s.user);

  if (!product) return null;

  const isTort = product.category === 'торты';
  const step = isTort ? 0.5 : 1;
  const minQty = isTort ? 1 : 1;
  const emoji = CATEGORY_EMOJI[product.category as ProductCategory] ?? '🍽️';
  const totalPrice = product.price * quantity;

  const maxQty = product.maxPerDay ?? 999;

  const handleIncrease = () => {
    setQuantity((prev) => {
      const next = Math.round((prev + step) * 10) / 10;
      return next <= maxQty ? next : prev;
    });
  };

  const handleDecrease = () => {
    setQuantity((prev) => {
      const next = Math.round((prev - step) * 10) / 10;
      return next >= minQty ? next : prev;
    });
  };

  const handleAdd = async () => {
    if (!user) {
      toast.error('Войдите в систему, чтобы добавить товар в корзину');
      onOpenChange(false);
      return;
    }
    setIsAdding(true);
    try {
      await addItem({
        product_id: product.id,
        name: product.name,
        category: product.category,
        flavor: product.flavor,
        size: product.size,
        quantity,
        unit: product.unit,
        price: product.price,
      });
      toast.success(`${product.name} добавлен в корзину`);
      onOpenChange(false);
      setQuantity(isTort ? 1 : 1);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Не удалось добавить в корзину');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setQuantity(isTort ? 1 : 1);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            {product.name}
          </DialogTitle>
          <DialogDescription>
            {product.description || 'Добавьте товар в корзину'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Product details */}
          <div className="flex flex-wrap gap-2">
            {product.flavor && (
              <Badge variant="secondary">{product.flavor}</Badge>
            )}
            {product.size && (
              <Badge variant="secondary">
                {product.size}
                {product.weightGrams ? ` (${product.weightGrams} г)` : ''}
              </Badge>
            )}
            <Badge variant="outline">
              {formatPrice(product.price)} / {product.unit}
            </Badge>
          </div>

          {/* Quantity stepper */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Количество ({product.unit}):</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={handleDecrease}
                disabled={quantity <= minQty}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-semibold text-lg tabular-nums">
                {isTort ? quantity.toFixed(1) : quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={handleIncrease}
                disabled={quantity >= maxQty}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Итого:</span>
            <span className="text-lg font-bold">{formatPrice(totalPrice)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            onClick={handleAdd}
            disabled={isAdding || !product.available}
          >
            {isAdding ? 'Добавление...' : 'Добавить в корзину'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
