import type { Product } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Серверные запросы к API для SSR и SEO (метаданные, sitemap).
 * Используют нативный fetch с ISR-кэшем — без axios-интерсепторов,
 * которые завязаны на браузерный стор авторизации.
 */

/** Один товар для SSR страницы и generateMetadata. Возвращает null, если не найден. */
export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_URL}/products/${encodeURIComponent(id)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Product;
  } catch {
    return null;
  }
}

/** Все товары для генерации sitemap. Возвращает [] при ошибке, чтобы не ломать сборку. */
export async function fetchAllProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_URL}/products`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as Product[]) : [];
  } catch {
    return [];
  }
}
