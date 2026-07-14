'use client';

import { useEffect, useRef } from 'react';

const WIDGET_SRC = 'https://yookassa.ru/checkout-widget/v1/checkout-widget.js';
const CONTAINER_ID = 'yookassa-widget-container';

interface YooMoneyCheckoutWidgetInstance {
  render: (containerId: string) => Promise<void>;
  destroy: () => void;
  on: (event: 'success' | 'fail' | 'complete' | 'modal_close', cb: () => void) => void;
}

declare global {
  interface Window {
    YooMoneyCheckoutWidget?: new (config: {
      confirmation_token: string;
      customization?: Record<string, unknown>;
      error_callback: (error: unknown) => void;
    }) => YooMoneyCheckoutWidgetInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadWidgetScript(): Promise<void> {
  if (window.YooMoneyCheckoutWidget) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = WIDGET_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Не удалось загрузить виджет ЮKassa'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

interface YookassaWidgetProps {
  confirmationToken: string;
  onSuccess: () => void;
  onFail?: (error?: unknown) => void;
}

/**
 * Встроенный виджет оплаты ЮKassa: карта, СБП и другие способы —
 * по настройкам кабинета магазина. Сумма и заказ зашиты в confirmation_token.
 */
export function YookassaWidget({ confirmationToken, onSuccess, onFail }: YookassaWidgetProps) {
  const widgetRef = useRef<YooMoneyCheckoutWidgetInstance | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onFailRef = useRef(onFail);
  // «Latest ref»: обновляется после рендера — писать в ref во время рендера нельзя.
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onFailRef.current = onFail;
  });

  useEffect(() => {
    let cancelled = false;

    loadWidgetScript()
      .then(() => {
        if (cancelled || !window.YooMoneyCheckoutWidget) return;
        const widget = new window.YooMoneyCheckoutWidget({
          confirmation_token: confirmationToken,
          error_callback: (error) => onFailRef.current?.(error),
        });
        widget.on('success', () => onSuccessRef.current());
        widget.on('fail', () => onFailRef.current?.());
        widget.render(CONTAINER_ID);
        widgetRef.current = widget;
      })
      .catch((e) => onFailRef.current?.(e));

    return () => {
      cancelled = true;
      widgetRef.current?.destroy();
      widgetRef.current = null;
    };
  }, [confirmationToken]);

  return <div id={CONTAINER_ID} className="min-h-[320px]" />;
}
