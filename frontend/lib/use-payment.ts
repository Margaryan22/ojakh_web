'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  CreatePaymentResponse,
  PaymentConfig,
  SyncPaymentResponse,
} from '@/types';

const SYNC_INTERVAL_MS = 4_000;

/** Активный платёжный провайдер (yookassa | manual) — задаётся бэкендом. */
export function usePaymentConfig() {
  return useQuery<PaymentConfig>({
    queryKey: ['payments-config'],
    queryFn: async () => {
      const { data } = await api.get<PaymentConfig>('/payments/config');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

interface UsePaymentFlowOptions {
  orderId: number;
  kind?: 'main' | 'doplata';
  onSucceeded: () => void;
  onCanceled?: () => void;
}

/**
 * Жизненный цикл одного платежа: создание (POST /payments/create),
 * и для ЮKassa — фоновый опрос POST /payments/:id/sync, пока виджет
 * открыт (страховка на случай недоставленного вебхука).
 */
export function usePaymentFlow({
  orderId,
  kind = 'main',
  onSucceeded,
  onCanceled,
}: UsePaymentFlowOptions) {
  const [payment, setPayment] = useState<CreatePaymentResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const settledRef = useRef(false);
  const onSucceededRef = useRef(onSucceeded);
  const onCanceledRef = useRef(onCanceled);
  // «Latest ref»: обновляется после рендера — писать в ref во время рендера нельзя.
  useEffect(() => {
    onSucceededRef.current = onSucceeded;
    onCanceledRef.current = onCanceled;
  });

  const start = useCallback(async (): Promise<CreatePaymentResponse> => {
    setIsCreating(true);
    try {
      const { data } = await api.post<CreatePaymentResponse>('/payments/create', {
        order_id: orderId,
        kind,
      });
      settledRef.current = false;
      setPayment(data);
      return data;
    } finally {
      setIsCreating(false);
    }
  }, [orderId, kind]);

  const reset = useCallback(() => {
    settledRef.current = true;
    setPayment(null);
  }, []);

  // Успех из события виджета: финализируем через sync (статус подтверждает
  // бэкенд у ЮKassa, клиентскому событию не доверяем).
  const settleFromWidget = useCallback(async () => {
    if (!payment || settledRef.current) return;
    try {
      const { data } = await api.post<SyncPaymentResponse>(
        `/payments/${payment.payment_id}/sync`,
      );
      if (data.status === 'succeeded' && !settledRef.current) {
        settledRef.current = true;
        setPayment(null);
        onSucceededRef.current();
      }
    } catch {
      // sync-поллинг ниже доведёт оплату
    }
  }, [payment]);

  useEffect(() => {
    if (!payment || payment.provider !== 'yookassa') return;

    const timer = setInterval(async () => {
      if (settledRef.current) return;
      try {
        const { data } = await api.post<SyncPaymentResponse>(
          `/payments/${payment.payment_id}/sync`,
        );
        if (settledRef.current) return;
        if (data.status === 'succeeded') {
          settledRef.current = true;
          setPayment(null);
          onSucceededRef.current();
        } else if (data.status === 'canceled') {
          settledRef.current = true;
          setPayment(null);
          onCanceledRef.current?.();
        }
      } catch {
        // временная ошибка сети — попробуем в следующем тике
      }
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [payment]);

  return { payment, isCreating, start, reset, settleFromWidget };
}
