'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

declare global {
  interface Window {
    onTelegramAuth: (user: any) => void;
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

const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;

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
  const telegramContainerRef = useRef<HTMLDivElement>(null);

  const handleSuccess = useCallback(() => {
    toast.success('Вы вошли в систему');
    router.push('/catalog');
  }, [router]);

  const handleError = useCallback((provider: string, err: any) => {
    const msg = err?.response?.data?.message || `Ошибка входа через ${provider}`;
    toast.error(msg);
  }, []);

  // ─── Telegram Login Widget ──────────────────────────────────────────────
  useEffect(() => {
    if (!TELEGRAM_BOT || !telegramContainerRef.current) return;

    window.onTelegramAuth = async (user: any) => {
      try {
        await socialLogin('telegram', user);
        handleSuccess();
      } catch (err: any) {
        handleError('Telegram', err);
      }
    };

    const container = telegramContainerRef.current;
    // Clear previous widget if any
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', TELEGRAM_BOT);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    container.appendChild(script);

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [socialLogin, handleSuccess, handleError]);

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

  // Don't render if no providers configured
  const hasAny = TELEGRAM_BOT || GOOGLE_CLIENT_ID || APPLE_CLIENT_ID;
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">или</span>
        </div>
      </div>

      {/* Telegram */}
      {TELEGRAM_BOT && (
        <div
          ref={telegramContainerRef}
          className="flex justify-center [&>iframe]:!rounded-xl"
        />
      )}

      {/* Google */}
      {GOOGLE_CLIENT_ID && (
        <div
          ref={googleBtnRef}
          className="flex justify-center"
        />
      )}

      {/* Apple */}
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
    </div>
  );
}
