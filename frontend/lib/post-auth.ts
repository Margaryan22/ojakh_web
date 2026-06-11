import { useCartStore } from '@/stores/cart.store';
import { useFavoritesStore } from '@/stores/favorites.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { queryClient } from '@/components/layout/query-provider';

const SAFE_NEXT = /^\/[^/]/; // only same-origin paths starting with single /

export function readNextFromQuery(searchParams: URLSearchParams | null): string {
  const next = searchParams?.get('next') ?? '';
  return next && SAFE_NEXT.test(next) ? next : '/catalog';
}

export async function finalizeAuthSuccess(): Promise<void> {
  // Вход под другим аккаунтом возможен и без logout — сбрасываем чужие кэши
  queryClient.clear();
  useNotificationsStore.setState({ items: [] });

  const localItems = useCartStore.getState().items;
  if (localItems.length > 0) {
    await useCartStore.getState().replaceServerWithLocal();
  } else {
    await useCartStore.getState().fetchCart();
  }
  // Гостевой ключ корзины потреблён — очищаем, чтобы он не достался следующему аккаунту
  try {
    useCartStore.persist.clearStorage();
  } catch {
    // ignore
  }

  const localFavorites = useFavoritesStore.getState().items;
  if (localFavorites.length > 0) {
    await useFavoritesStore.getState().mergeLocalToServer();
  } else {
    await useFavoritesStore.getState().fetchFavorites();
  }
}
