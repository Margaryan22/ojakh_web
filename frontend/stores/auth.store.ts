import { create } from 'zustand';
import api from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
}

interface AuthActions {
  setAccessToken: (token: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; name: string; password: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  isInitialized: false,

  setAccessToken: (token: string) => {
    set({ accessToken: token });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      set({
        user: data.user,
        accessToken: data.accessToken,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (registerData) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/register', registerData);
      set({
        user: data.user,
        accessToken: data.accessToken,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore errors on logout
    }
    set({ user: null, accessToken: null });
  },

  loadUser: async () => {
    const { accessToken } = get();
    if (!accessToken) {
      set({ isInitialized: true });
      return;
    }
    set({ isLoading: true });
    try {
      const { data } = await api.get('/users/me');
      set({ user: data, isLoading: false, isInitialized: true });
    } catch {
      set({ user: null, accessToken: null, isLoading: false, isInitialized: true });
    }
  },

  updateProfile: async (profileData) => {
    const { data } = await api.patch('/users/me', profileData);
    set({ user: data });
  },
}));
