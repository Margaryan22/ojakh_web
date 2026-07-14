import { ProductGridSkeleton } from '@/components/products/product-grid-skeleton';

// Мгновенный скелетон каталога на время загрузки сегмента.
export default function CatalogLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-40 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-72 rounded-md bg-muted animate-pulse" />
      </div>
      <ProductGridSkeleton />
    </div>
  );
}
