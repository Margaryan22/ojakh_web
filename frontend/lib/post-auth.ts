import { useCartStore } from '@/stores/cart.store';

const SAFE_NEXT = /^\/[^/]/; // only same-origin paths starting with single /

export function readNextFromQuery(searchParams: URLSearchParams | null): string {
  const next = searchParams?.get('next') ?? '';
  return next && SAFE_NEXT.test(next) ? next : '/catalog';
}

export async function finalizeAuthSuccess(): Promise<void> {
  const localItems = useCartStore.getState().items;
  if (localItems.length > 0) {
    await useCartStore.getState().replaceServerWithLocal();
  } else {
    await useCartStore.getState().fetchCart();
  }
}
