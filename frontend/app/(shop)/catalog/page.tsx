'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductCard } from '@/components/products/product-card';
import { AddToCartDialog } from '@/components/products/add-to-cart-dialog';
import { ProductGridSkeleton } from '@/components/products/product-grid-skeleton';
import { CategoryNav } from '@/components/products/category-nav';
import { FadeIn } from '@/components/motion/fade-in';
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/constants';
import type { Product, ProductCategory } from '@/types';

type CatalogSort = 'default' | 'price_asc' | 'price_desc' | 'new';

const SORT_LABELS: Record<CatalogSort, string> = {
  default: 'По категориям',
  price_asc: 'Сначала дешевле',
  price_desc: 'Сначала дороже',
  new: 'Новинки',
};

function CatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dialogProduct, setDialogProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Состояние живёт в URL (?q=...&sort=...) — ссылкой можно поделиться.
  const urlQuery = searchParams.get('q') ?? '';
  const urlSort = (searchParams.get('sort') as CatalogSort) ?? 'default';
  const sort: CatalogSort = SORT_LABELS[urlSort] ? urlSort : 'default';

  const [searchInput, setSearchInput] = useState(urlQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyParams = (q: string, s: CatalogSort) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (s !== 'default') params.set('sort', s);
    const qs = params.toString();
    router.replace(qs ? `/catalog?${qs}` : '/catalog', { scroll: false });
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyParams(value.trim(), sort), 300);
  };

  const clearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchInput('');
    applyParams('', sort);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const { data: products = [], isLoading, error } = useQuery<Product[]>({
    queryKey: ['products', urlQuery, sort],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (urlQuery) params.search = urlQuery;
      if (sort !== 'default') params.sort = sort;
      const { data } = await api.get('/products', { params });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const available = useMemo(
    () => products.filter((p) => p.available),
    [products],
  );

  // Без поиска и сортировки — привычный сгруппированный по категориям вид.
  const grouped = !urlQuery && sort === 'default';

  const groups = useMemo(() => {
    if (!grouped) return [];
    return CATEGORY_ORDER
      .map((cat) => ({
        category: cat as ProductCategory,
        items: available.filter((p) => p.category === cat),
      }))
      .filter((g) => g.items.length > 0);
  }, [available, grouped]);

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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Найти блюдо или торт..."
            className="pl-10 pr-9"
            aria-label="Поиск по каталогу"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Очистить поиск"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={sort}
          onValueChange={(v) => applyParams(searchInput.trim(), v as CatalogSort)}
        >
          <SelectTrigger className="w-full sm:w-52" aria-label="Сортировка">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as CatalogSort[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground">
          Не удалось загрузить каталог. Попробуйте позже.
        </div>
      ) : grouped ? (
        groups.length === 0 ? (
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
        )
      ) : available.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-lg">Ничего не нашлось 😔</p>
          <p className="text-muted-foreground text-sm">
            Попробуйте изменить запрос — например, «хинкали» или «торт».
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Найдено: {available.length}
          </p>
          <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {available.map((product) => (
              <StaggerItem key={product.id}>
                <ProductCard product={product} onAdd={handleAddClick} />
              </StaggerItem>
            ))}
          </StaggerContainer>
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

// useSearchParams требует Suspense-границу при статической генерации страницы.
export default function CatalogPage() {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <CatalogContent />
    </Suspense>
  );
}
