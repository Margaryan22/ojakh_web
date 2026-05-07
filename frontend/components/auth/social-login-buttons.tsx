'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (el: HTMLElement, config: any) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: any) => void;
        signIn: () => Promise<any>;
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
const YANDEX_CLIENT_ID = process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID;
const YANDEX_STATE_KEY = 'yandex_oauth_state';

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.head.appendChild(script);
  });
}

export function SocialLoginButtons() {
  const router = useRouter();
  const socialLogin = useAuthStore((s) => s.socialLogin);
  const isLoading = useAuthStore((s) => s.isLoading);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleSuccess = useCallback(() => {
    toast.success('Вы вошли в систему');
    router.push('/catalog');
  }, [router]);

  const handleError = useCallback((provider: string, err: any) => {
    const msg = err?.response?.data?.message || `Ошибка входа через ${provider}`;
    toast.error(msg);
  }, []);

  // ─── Google Sign-In ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;

    loadScript('https://accounts.google.com/gsi/client', 'google-gsi').then(() => {
      if (!window.google || !googleBtnRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          try {
            await socialLogin('google', { idToken: response.credential });
            handleSuccess();
          } catch (err: any) {
            handleError('Google', err);
          }
        },
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleBtnRef.current.offsetWidth,
        text: 'continue_with',
        shape: 'pill',
        locale: 'ru',
      });
    });
  }, [socialLogin, handleSuccess, handleError]);

  // ─── Apple Sign-In ──────────────────────────────────────────────────────
  const handleAppleLogin = useCallback(async () => {
    if (!APPLE_CLIENT_ID) return;

    try {
      await loadScript(
        'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
        'apple-auth',
      );

      window.AppleID!.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: window.location.origin + '/login',
        usePopup: true,
      });

      const response = await window.AppleID!.auth.signIn();
      const idToken = response.authorization?.id_token;
      if (!idToken) throw new Error('No id_token');

      const name = response.user
        ? [response.user.name?.firstName, response.user.name?.lastName].filter(Boolean).join(' ')
        : undefined;

      await socialLogin('apple', { idToken, name });
      handleSuccess();
    } catch (err: any) {
      if (err?.error === 'popup_closed_by_user') return;
      handleError('Apple', err);
    }
  }, [socialLogin, handleSuccess, handleError]);

  // ─── Yandex ID (OAuth implicit redirect, без SDK — не блокируется адблокерами) ──
  useEffect(() => {
    if (!YANDEX_CLIENT_ID) return;
    if (typeof window === 'undefined') return;
    if (!window.location.hash) return;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const returnedState = params.get('state');
    const error = params.get('error');

    if (error) {
      handleError('Yandex', { response: { data: { message: params.get('error_description') || error } } });
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    if (!accessToken) return;

    const savedState = sessionStorage.getItem(YANDEX_STATE_KEY);
    sessionStorage.removeItem(YANDEX_STATE_KEY);
    window.history.replaceState(null, '', window.location.pathname);

    if (!savedState || savedState !== returnedState) {
      handleError('Yandex', { response: { data: { message: 'Неверный state — попробуйте снова' } } });
      return;
    }

    (async () => {
      try {
        await socialLogin('yandex', { accessToken });
        handleSuccess();
      } catch (err: any) {
        handleError('Yandex', err);
      }
    })();
  }, [socialLogin, handleSuccess, handleError]);

  const handleYandexLogin = useCallback(() => {
    if (!YANDEX_CLIENT_ID) return;

    const state = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(YANDEX_STATE_KEY, state);

    const redirectUri = `${window.location.origin}/login`;
    const url =
      `https://oauth.yandex.ru/authorize?response_type=token` +
      `&client_id=${encodeURIComponent(YANDEX_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&force_confirm=yes`;

    window.location.href = url;
  }, []);

  const hasAny = GOOGLE_CLIENT_ID || APPLE_CLIENT_ID || YANDEX_CLIENT_ID;
  if (!hasAny) return null;

  return (
    <div className="space-y-3 w-full">
      {GOOGLE_CLIENT_ID && (
        <div ref={googleBtnRef} className="flex justify-center" />
      )}

      {APPLE_CLIENT_ID && (
        <button
          type="button"
          onClick={handleAppleLogin}
          disabled={isLoading}
          className="w-full h-11 rounded-xl border border-border bg-black text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-black/90 transition-colors disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Продолжить с Apple
        </button>
      )}

      {YANDEX_CLIENT_ID && (
        <button
          type="button"
          onClick={handleYandexLogin}
          disabled={isLoading}
          className="w-full h-11 rounded-xl border border-border bg-[#FC3F1D] text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#e0381a] transition-colors disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M13.32 21.5h2.74V2.5h-3.99c-4 0-6.1 2.06-6.1 5.07 0 2.41 1.16 3.83 3.21 5.27L5.62 21.5h2.97l3.96-9.74-1.39-.93c-1.66-1.12-2.47-1.99-2.47-3.85 0-1.64 1.16-2.74 3.36-2.74h1.27V21.5z"/>
          </svg>
          Продолжить с Яндекс ID
        </button>
      )}
    </div>
  );
}
