'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const URGENT_THRESHOLD_MS = 3 * 60 * 1000; // < 3 минут — красная зона

function remainingMs(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Тикающий обратный отсчёт до дедлайна оплаты. Возвращает оставшиеся мс,
 * признак «скоро истечёт» и флаг истечения. Один раз дёргает onExpired,
 * когда таймер достигает нуля (чтобы родитель перезапросил заказ).
 */
export function usePaymentCountdown(expiresAt: string, onExpired?: () => void) {
  const [ms, setMs] = useState(() => remainingMs(expiresAt));
  const firedRef = useRef(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    firedRef.current = false;
    setMs(remainingMs(expiresAt));

    const tick = () => {
      const left = remainingMs(expiresAt);
      setMs(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpiredRef.current?.();
      }
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return {
    ms,
    label: formatClock(ms),
    isUrgent: ms > 0 && ms <= URGENT_THRESHOLD_MS,
    isExpired: ms <= 0,
  };
}

interface PaymentTimerProps {
  expiresAt: string;
  onExpired?: () => void;
}

/** Баннер обратного отсчёта над блоком оплаты на странице заказа. */
export function PaymentTimer({ expiresAt, onExpired }: PaymentTimerProps) {
  const { label, isUrgent, isExpired } = usePaymentCountdown(expiresAt, onExpired);

  if (isExpired) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors',
        isUrgent
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
    >
      <div className="flex items-center gap-2">
        <Clock className={cn('h-5 w-5', isUrgent && 'animate-pulse')} />
        <span className="text-sm font-medium">Осталось на оплату</span>
      </div>
      <span
        className={cn(
          'font-mono text-lg font-bold tabular-nums',
          isUrgent && 'animate-pulse',
        )}
      >
        {label}
      </span>
    </div>
  );
}

interface PaymentTimerBadgeProps {
  expiresAt: string;
  onExpired?: () => void;
}

/** Компактный бейдж обратного отсчёта для карточки заказа в списке. */
export function PaymentTimerBadge({ expiresAt, onExpired }: PaymentTimerBadgeProps) {
  const { label, isUrgent, isExpired } = usePaymentCountdown(expiresAt, onExpired);

  if (isExpired) return null;

  return (
    <Badge
      className={cn(
        'gap-1 font-mono tabular-nums',
        isUrgent
          ? 'bg-destructive/10 text-destructive'
          : 'bg-amber-100 text-amber-800',
      )}
    >
      <Clock className="h-3 w-3" />
      {label}
    </Badge>
  );
}
