'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';

type SseHandlers = Record<string, (data: unknown) => void>;

/**
 * Подписка на SSE-поток событий бекенда (GET /events/stream).
 *
 * handlers — карта «тип события → обработчик» (типы см. в
 * backend/src/modules/events/events.service.ts). EventSource сам
 * переподключается при обрывах; при невалидном/истёкшем токене connected
 * останется false — вызывающая сторона использует это как сигнал включить
 * fallback-поллинг. Ключи handlers должны быть стабильны между рендерами.
 */
export function useSse(handlers: SseHandlers, enabled = true) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [connected, setConnected] = useState(false);

  // «Latest ref»: обработчики меняются между рендерами, соединение — нет.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const eventTypes = Object.keys(handlers).sort().join(',');

  useEffect(() => {
    if (!enabled || !accessToken || typeof window === 'undefined') {
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const es = new EventSource(
      `${apiUrl}/events/stream?token=${encodeURIComponent(accessToken)}`,
    );

    es.onopen = () => setConnected(true);
    // EventSource переподключается сам; на время обрыва включаем fallback.
    es.onerror = () => setConnected(false);

    for (const type of eventTypes.split(',').filter(Boolean)) {
      es.addEventListener(type, (e) => {
        let data: unknown;
        try {
          data = JSON.parse((e as MessageEvent).data);
        } catch {
          data = (e as MessageEvent).data;
        }
        handlersRef.current[type]?.(data);
      });
    }

    return () => {
      es.close();
      setConnected(false);
    };
  }, [enabled, accessToken, eventTypes]);

  return { connected };
}
