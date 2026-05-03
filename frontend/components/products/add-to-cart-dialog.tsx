'use client';

import { useState, useEffect } from 'react';
import { Info, Minus, Plus } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NutritionInfo } from '@/components/products/nutrition-info';
import { formatPrice } from '@/lib/format';
import { CATEGORY_EMOJI, MAX_ITEM_QTY_PER_ORDER, MAX_TORTS_PER_ORDER, CAKE_CATEGORY } from '@/lib/constants';
import { useCartStore } from '@/stores/cart.store';
import { useAuthStore } from '@/stores/auth.store';
import type { Product, ProductCategory } from '@/types';

interface AddToCartDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToCartDialog({ product, open, onOpenChange }: AddToCartDialogProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [inputValue, setInputValue] = useState('1');
  const addItem = useCartStore((s) => s.addItem);
  const getItemByKey = useCartStore((s) => s.getItemByKey);
  const user = useAuthStore((s) => s.user);

  const isTort = product?.category === CAKE_CATEGORY;
  const existingItem = product ? getItemByKey(product.id, product.flavor, product.size) : undefined;
  const existingQty = existingItem?.quantity ?? 0;
  const productMax = product
    ? isTort
      ? Math.min(product.maxPerDay ?? MAX_TORTS_PER_ORDER, MAX_TORTS_PER_ORDER)
      : Math.min(product.maxPerDay ?? MAX_ITEM_QTY_PER_ORDER, MAX_ITEM_QTY_PER_ORDER)
    : 1;
  const available = Math.max(0, productMax - existingQty);
  const maxQty = available;
  const isAtLimit = maxQty <= 0;

  // Reset quantity when dialog opens or product changes
  useEffect(() => {
    if (!open || !product) return;
    const step = isTort ? 0.5 : 1;
    const initial = Math.min(isTort ? 1.0 : 1, maxQty > 0 ? maxQty : step);
    setQuantity(initial);
    setInputValue(isTort ? initial.toFixed(1) : String(initial));
  }, [open, product?.id]);

  if (!product) return null;

  const step = isTort ? 0.5 : 1;
  const minQty = 1;
  const emoji = CATEGORY_EMOJI[product.category as ProductCategory] ?? '🍽️';

  const totalPrice = product.price * quantity;

  const clamp = (val: number) => Math.min(maxQty, Math.max(minQty, val));

  const applyQuantity = (val: number) => {
    const clamped = clamp(Math.round(val * 10) / 10);
    setQuantity(clamped);
    setInputValue(isTort ? clamped.toFixed(1) : String(clamped));
  };

  const handleIncrease = () => applyQuantity(quantity + step);
  const handleDecrease = () => applyQuantity(quantity - step);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (isTort) {
      if (!/^\d*\.?\d?$/.test(raw)) return;
    } else {
      if (!/^\d*$/.test(raw)) return;
    }
    setInputValue(raw);

    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= minQty) {
      setQuantity(Math.round(clamp(parsed) * 10) / 10);
    }
  };

  const handleInputBlur = () => {
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed) || parsed < minQty) {
      applyQuantity(minQty);
    } else {
      applyQuantity(parsed);
    }
  };

  const handleAdd = async () => {
    if (!user) {
      toast.error('Войдите в систему, чтобы добавить товар в корзину');
      onOpenChange(false);
      return;
    }
    if (isAtLimit) return;

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
        maxPerCart: productMax,
      });
      toast.success(`${product.name} добавлен в корзину`);
      onOpenChange(false);
      applyQuantity(minQty);
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
      applyQuantity(minQty);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <span className="text-2xl">{emoji}</span>
            <span className="flex-1">{product.name}</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Пищевая ценность"
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Info className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-64">
                <NutritionInfo product={product} />
              </PopoverContent>
            </Popover>
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

          {/* At-limit message */}
          {isAtLimit ? (
            <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground text-center">
              Максимальное количество добавлено ({productMax}&nbsp;{product.unit})
            </div>
          ) : (
            <>
              {existingQty > 0 && (
                <p className="text-xs text-muted-foreground">
                  Уже в корзине: {existingQty}&nbsp;{product.unit}. Можно добавить ещё: {available}&nbsp;{product.unit}
                </p>
              )}

              {/* Quantity stepper */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Количество ({product.unit}):</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={handleDecrease}
                      disabled={quantity <= minQty}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="text"
                      inputMode={isTort ? 'decimal' : 'numeric'}
                      value={inputValue}
                      onChange={handleInputChange}
                      onBlur={handleInputBlur}
                      className="w-16 text-center font-semibold text-lg tabular-nums px-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={handleIncrease}
                      disabled={quantity >= maxQty}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  Максимум: {productMax}&nbsp;{product.unit}
                </p>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">Итого:</span>
                <span className="text-lg font-bold">{formatPrice(totalPrice)}</span>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            onClick={handleAdd}
            disabled={isAdding || !product.available || isAtLimit}
          >
            {isAtLimit
              ? 'Максимальное количество добавлено'
              : isAdding
              ? 'Добавление...'
              : 'Добавить в корзину'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
