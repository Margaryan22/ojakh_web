'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import api from '@/lib/api';
import { ProductCard } from '@/components/products/product-card';
import { AddToCartDialog } from '@/components/products/add-to-cart-dialog';
import { ProductGridSkeleton } from '@/components/products/product-grid-skeleton';
import { CategoryNav } from '@/components/products/category-nav';
import { Input } from '@/components/ui/input';
import { FadeIn } from '@/components/motion/fade-in';
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/constants';
import type { Product, ProductCategory } from '@/types';

export default function CatalogPage() {
  const [dialogProduct, setDialogProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const { data: products = [], isLoading, error } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get('/products');
      return data;
    },
  });

  const available = useMemo(() => products.filter((p) => p.available), [products]);

  const query = search.trim().toLowerCase();
  // Цены вводятся в рублях, товары хранятся в копейках.
  const minK = minPrice.trim() ? Number(minPrice) * 100 : null;
  const maxK = maxPrice.trim() ? Number(maxPrice) * 100 : null;
  const isFiltering = query.length > 0 || minK !== null || maxK !== null;

  // Плоский отфильтрованный список (режим поиска / фильтра по цене).
  const filtered = useMemo(() => {
    let list = available;
    if (query) {
      list = list.filter((p) =>
        [p.name, p.flavor, p.description]
          .filter(Boolean)
          .some((f) => (f as string).toLowerCase().includes(query)),
      );
    }
    if (minK !== null) list = list.filter((p) => p.price >= minK);
    if (maxK !== null) list = list.filter((p) => p.price <= maxK);
    return list;
  }, [available, query, minK, maxK]);

  // Группировка по категориям (вид по умолчанию).
  const groups = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      category: cat as ProductCategory,
      items: available.filter((p) => p.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [available]);

  const handleAddClick = (product: Product) => {
    setDialogProduct(product);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-bold">Каталог</h1>
        <p className="text-muted-foreground mt-1">
          Домашние полуфабрикаты, торты и десерты
        </p>
      </FadeIn>

      {/* Поиск, сортировка, цена */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Цена, ₽:</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="от"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="h-9 w-24"
          />
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="до"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="h-9 w-24"
          />
        </div>
      </div>

      {isLoading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground">
          Не удалось загрузить каталог. Попробуйте позже.
        </div>
      ) : available.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Пока нет доступных товаров
        </div>
      ) : isFiltering ? (
        filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Ничего не найдено
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Найдено: {filtered.length}
            </p>
            <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((product) => (
                <StaggerItem key={product.id}>
                  <ProductCard product={product} onAdd={handleAddClick} />
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        )
      ) : (
        <>
          <CategoryNav categories={groups.map((g) => g.category)} />

          <div className="space-y-10">
            {groups.map(({ category, items }, i) => (
              <FadeIn key={category} delay={i * 0.05}>
                <section id={category} className="scroll-mt-32 space-y-3">
                  <h2 className="text-xl font-bold">{CATEGORY_LABELS[category]}</h2>
                  <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map((product) => (
                      <StaggerItem key={product.id}>
                        <ProductCard product={product} onAdd={handleAddClick} />
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
