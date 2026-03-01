import { create } from 'zustand';
import api from '@/lib/api';

export interface AppNotification {
  id: number;
  orderId: number;
  status: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsState {
  items: AppNotification[];
  isLoading: boolean;
}

interface NotificationsActions {
  fetch: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markOneRead: (id: number) => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState & NotificationsActions>((set, get) => ({
  items: [],
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<AppNotification[]>('/notifications');
      set({ items: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  markAllRead: async () => {
    await api.patch('/notifications/read-all');
    set({ items: get().items.map((n) => ({ ...n, isRead: true })) });
  },

  markOneRead: async (id: number) => {
    await api.patch(`/notifications/${id}/read`);
    set({ items: get().items.map((n) => (n.id === id ? { ...n, isRead: true } : n)) });
  },
}));
