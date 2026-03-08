import { create } from 'zustand';
import api from '@/lib/api';
import type { CartItem } from '@/types';
import { MAX_TORTS_PER_ORDER } from '@/lib/constants';

interface CartState {
  items: CartItem[];
  isLoading: boolean;
}

interface CartActions {
  fetchCart: () => Promise<void>;
  addItem: (item: Omit<CartItem, 'subtotal'>) => Promise<void>;
  updateQuantity: (productId: number, quantity: number, flavor?: string, size?: string) => Promise<void>;
  removeItem: (productId: number, flavor?: string, size?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: () => number;
  totalPrice: () => number;
  tortCount: () => number;
  getItemQuantity: (productId: number) => number;
}

function matchItem(item: CartItem, productId: number, flavor?: string, size?: string): boolean {
  return (
    item.product_id === productId &&
    (item.flavor ?? '') === (flavor ?? '') &&
    (item.size ?? '') === (size ?? '')
  );
}

export const useCartStore = create<CartState & CartActions>((set, get) => ({
  items: [],
  isLoading: false,

  fetchCart: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/cart');
      set({ items: data.items ?? [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addItem: async (newItem) => {
    const { items } = get();
    const subtotal = newItem.price * newItem.quantity;
    const itemWithSubtotal: CartItem = { ...newItem, subtotal };

    // Check tort limit
    if (newItem.category === 'торты') {
      const currentTortCount = get().tortCount();
      if (currentTortCount + 1 > MAX_TORTS_PER_ORDER) {
        throw new Error(`Максимум ${MAX_TORTS_PER_ORDER} торта в одном заказе`);
      }
    }

    // Optimistic update
    const existingIndex = items.findIndex((i) =>
      matchItem(i, newItem.product_id, newItem.flavor, newItem.size)
    );

    let optimisticItems: CartItem[];
    if (existingIndex >= 0) {
      optimisticItems = items.map((item, idx) => {
        if (idx === existingIndex) {
          const newQty = item.quantity + newItem.quantity;
          return { ...item, quantity: newQty, subtotal: item.price * newQty };
        }
        return item;
      });
    } else {
      optimisticItems = [...items, itemWithSubtotal];
    }

    set({ items: optimisticItems });

    try {
      const { data } = await api.post('/cart/items', {
        product_id: newItem.product_id,
        name: newItem.name,
        category: newItem.category,
        flavor: newItem.flavor,
        size: newItem.size,
        quantity: newItem.quantity,
        unit: newItem.unit,
        price: newItem.price,
      });
      set({ items: data.items ?? [] });
    } catch (error) {
      // Revert on error
      set({ items });
      throw error;
    }
  },

  updateQuantity: async (productId, quantity, flavor?, size?) => {
    const { items } = get();
    const prevItems = [...items];

    const currentItem = items.find((item) => matchItem(item, productId, flavor, size));
    if (!currentItem) return;

    const optimistic = items.map((item) => {
      if (matchItem(item, productId, flavor, size)) {
        return { ...item, quantity, subtotal: item.price * quantity };
      }
      return item;
    });
    set({ items: optimistic });

    try {
      const delta = quantity - currentItem.quantity;
      const { data } = await api.post('/cart/items', {
        product_id: productId,
        name: currentItem.name,
        category: currentItem.category,
        flavor,
        size,
        quantity: delta,
        unit: currentItem.unit,
        price: currentItem.price,
      });
      set({ items: data.items ?? [] });
    } catch {
      set({ items: prevItems });
    }
  },

  removeItem: async (productId, flavor?, size?) => {
    const { items } = get();
    const prevItems = [...items];
    const optimistic = items.filter((i) => !matchItem(i, productId, flavor, size));
    set({ items: optimistic });

    try {
      const { data } = await api.delete('/cart/items', {
        params: { product_id: productId, flavor, size },
      });
      set({ items: data.items ?? [] });
    } catch {
      set({ items: prevItems });
    }
  },

  clearCart: async () => {
    const { items } = get();
    set({ items: [] });
    try {
      await api.delete('/cart');
    } catch {
      set({ items });
    }
  },

  totalItems: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  totalPrice: () => {
    return get().items.reduce((sum, item) => sum + item.subtotal, 0);
  },

  tortCount: () => {
    return get().items.filter((item) => item.category === 'торты').length;
  },

  getItemQuantity: (productId) => {
    const item = get().items.find((i) => i.product_id === productId);
    return item?.quantity ?? 0;
  },
}));
