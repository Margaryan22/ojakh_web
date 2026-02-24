import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/types';

interface FavoritesState {
  items: Product[];
}

interface FavoritesActions {
  add: (product: Product) => void;
  remove: (productId: number) => void;
  toggle: (product: Product) => void;
  has: (productId: number) => boolean;
}

export const useFavoritesStore = create<FavoritesState & FavoritesActions>()(
  persist(
    (set, get) => ({
      items: [],

      add: (product) => {
        const { items } = get();
        if (!items.some((p) => p.id === product.id)) {
          set({ items: [...items, product] });
        }
      },

      remove: (productId) => {
        set({ items: get().items.filter((p) => p.id !== productId) });
      },

      toggle: (product) => {
        const { items } = get();
        if (items.some((p) => p.id === product.id)) {
          set({ items: items.filter((p) => p.id !== product.id) });
        } else {
          set({ items: [...items, product] });
        }
      },

      has: (productId) => {
        return get().items.some((p) => p.id === productId);
      },
    }),
    {
      name: 'ojakh-favorites',
    }
  )
);
