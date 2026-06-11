import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { Product } from '@/types';

interface FavoritesState {
  items: Product[];
}

interface FavoritesActions {
  fetchFavorites: () => Promise<void>;
  add: (product: Product) => Promise<void>;
  remove: (productId: number) => Promise<void>;
  toggle: (product: Product) => Promise<void>;
  has: (productId: number) => boolean;
  mergeLocalToServer: () => Promise<void>;
}

const isGuest = () => useAuthStore.getState().user === null;

export const useFavoritesStore = create<FavoritesState & FavoritesActions>()(
  persist(
    (set, get) => ({
      items: [],

      fetchFavorites: async () => {
        if (isGuest()) return; // persist уже восстановил локальное состояние
        try {
          const { data } = await api.get('/favorites');
          set({ items: data.items ?? [] });
        } catch {
          // ignore
        }
      },

      add: async (product) => {
        const { items } = get();
        if (items.some((p) => p.id === product.id)) return;
        set({ items: [...items, product] });

        if (isGuest()) return;

        try {
          const { data } = await api.post(`/favorites/${product.id}`);
          set({ items: data.items ?? [] });
        } catch {
          set({ items });
        }
      },

      remove: async (productId) => {
        const { items } = get();
        set({ items: items.filter((p) => p.id !== productId) });

        if (isGuest()) return;

        try {
          const { data } = await api.delete(`/favorites/${productId}`);
          set({ items: data.items ?? [] });
        } catch {
          set({ items });
        }
      },

      toggle: async (product) => {
        if (get().items.some((p) => p.id === product.id)) {
          await get().remove(product.id);
        } else {
          await get().add(product);
        }
      },

      has: (productId) => {
        return get().items.some((p) => p.id === productId);
      },

      // После логина: гостевое избранное переносится в аккаунт одним запросом.
      mergeLocalToServer: async () => {
        const local = get().items;
        try {
          const { data } = await api.post('/favorites/merge', {
            productIds: local.map((p) => p.id),
          });
          set({ items: data.items ?? [] });
          useFavoritesStore.persist.clearStorage();
        } catch {
          // оставляем локальное состояние, сервер подтянется при следующем fetch
        }
      },
    }),
    {
      // Новый ключ: старый общий 'ojakh-favorites' игнорируется, утёкшие данные не подхватятся
      name: 'ojakh-favorites-guest',
      storage: createJSONStorage(() => localStorage),
      // Избранное залогиненного пользователя живёт на сервере и не пишется в общий гостевой ключ
      partialize: (state) => ({ items: isGuest() ? state.items : [] }),
    }
  )
);
