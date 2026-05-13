'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Truck } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice, formatDateFull } from '@/lib/format';
import { STATUS_LABELS, STATUS_COLORS, WAREHOUSE_ADDRESS } from '@/lib/constants';
import { useAuthStore } from '@/stores/auth.store';
import type { Order, OrderStatus, DeliveryQuote, DeliveryClaimResponse } from '@/types';
import { useState } from 'react';
import { AxiosError } from 'axios';

const ACTIVE_CLAIM_STATUSES: OrderStatus[] = [
  'awaiting_payment_for_courier',
  'delivering',
];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [isPaying, setIsPaying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isCreatingClaim, setIsCreatingClaim] = useState(false);
  const [isPayingDoplata, setIsPayingDoplata] = useState(false);

  const orderId = params.id as string;

  const { data: order, isLoading, refetch } = useQuery<Order>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}`);
      return data;
    },
    enabled: !!user && !!orderId,
    refetchInterval: (query) => {
      const status = query.state.data?.status as OrderStatus | undefined;
      if (!status) return false;
      return ACTIVE_CLAIM_STATUSES.includes(status) ? 15_000 : false;
    },
  });

  const handleCancel = async () => {
    if (!confirm('Вы уверены, что хотите отменить заказ?')) return;
    setIsCancelling(true);
    try {
      await api.patch(`/orders/${orderId}/cancel`);
      toast.success('Заказ отменён');
      refetch();
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка отмены заказа');
      } else {
        toast.error('Ошибка отмены заказа');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePay = async () => {
    if (!order?.paymentId) {
      toast.error('Платёж не найден');
      return;
    }
    setIsPaying(true);
    try {
      await api.post(`/payments/confirm/${order.paymentId}`);
      toast.success('Оплата прошла успешно');
      refetch();
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка оплаты');
      } else {
        toast.error('Ошибка оплаты');
      }
    } finally {
      setIsPaying(false);
    }
  };

  const handleRequestQuote = async () => {
    setIsQuoting(true);
    try {
      const { data } = await api.post<DeliveryQuote>(`/orders/${orderId}/delivery-quote`);
      setQuote(data);
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Не удалось получить расчёт');
      } else {
        toast.error('Не удалось получить расчёт');
      }
    } finally {
      setIsQuoting(false);
    }
  };

  const handleConfirmClaim = async () => {
    if (!quote) return;
    setIsCreatingClaim(true);
    try {
      const { data } = await api.post<DeliveryClaimResponse>(
        `/orders/${orderId}/delivery-claim`,
        { recalcId: quote.recalcId },
      );
      if (data.status === 'awaiting_payment') {
        toast.message('Подтвердите доплату за доставку');
        setIsPayingDoplata(true);
        try {
          await api.post(`/payments/confirm/${data.doplataPaymentId}`);
          toast.success('Заказ передан в доставку');
        } catch (e) {
          if (e instanceof AxiosError) {
            toast.error(e.response?.data?.message ?? 'Ошибка оплаты доплаты');
          } else {
            toast.error('Ошибка оплаты доплаты');
          }
          return;
        } finally {
          setIsPayingDoplata(false);
        }
      } else {
        toast.success('Заказ передан в доставку');
      }
      setQuote(null);
      refetch();
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Не удалось оформить доставку');
        if (error.response?.status === 410) {
          setQuote(null);
        }
      } else {
        toast.error('Не удалось оформить доставку');
      }
    } finally {
      setIsCreatingClaim(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <Button onClick={() => router.push('/login')}>Войти</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Заказ не найден</p>
      </div>
    );
  }

  const canCallCourier =
    order.status === 'ready' && !order.isPickup && !order.dispatchedAt;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Заказ #{order.orderNumber ?? order.id}</h1>
        <Badge className={STATUS_COLORS[order.status as OrderStatus]}>
          {STATUS_LABELS[order.status as OrderStatus]}
        </Badge>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Состав заказа</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span>
                {item.name}
                {item.flavor ? ` (${item.flavor})` : ''}
                {item.size ? ` ${item.size}` : ''}
                {' '}&times; {item.quantity} {item.unit}
              </span>
              <span className="font-medium">{formatPrice(item.subtotal)}</span>
            </div>
          ))}
          <Separator />
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Товары:</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.deliveryCost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Доставка:</span>
                <span>{formatPrice(order.deliveryCost)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Итого:</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Доставка</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Тип:</span>{' '}
            {order.isPickup ? 'Самовывоз' : 'Доставка'}
          </p>
          {order.address && (
            <p>
              <span className="text-muted-foreground">Адрес:</span> {order.address}
            </p>
          )}
          {order.isPickup && (
            <p>
              <span className="text-muted-foreground">Адрес самовывоза:</span>{' '}
              {WAREHOUSE_ADDRESS}
            </p>
          )}
          {order.recipientName && (
            <p>
              <span className="text-muted-foreground">Получатель:</span> {order.recipientName}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Дата:</span>{' '}
            {formatDateFull(order.deliveryDate)}
          </p>
          {order.deliveryTime && (
            <p>
              <span className="text-muted-foreground">Время:</span> {order.deliveryTime}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Создан:</span>{' '}
            {formatDateFull(order.createdAt)}
          </p>
          {order.paidAt && (
            <p>
              <span className="text-muted-foreground">Оплачен:</span>{' '}
              {formatDateFull(order.paidAt)}
            </p>
          )}
          {order.dispatchedAt && (
            <p className="pt-1 border-t">
              <span className="text-muted-foreground">Статус доставки:</span>{' '}
              <span className="font-medium">
                {STATUS_LABELS[order.status as OrderStatus]}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pay button for new orders */}
      {order.status === 'new' && order.paymentId && (
        <Button
          className="w-full"
          size="lg"
          onClick={handlePay}
          disabled={isPaying}
        >
          {isPaying ? 'Оплата...' : `Оплатить ${formatPrice(order.subtotal)}`}
        </Button>
      )}

      {/* Cancel button for new (unpaid) orders */}
      {order.status === 'new' && (
        <Button
          variant="destructive"
          className="w-full"
          size="lg"
          onClick={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? 'Отмена...' : 'Отменить заказ'}
        </Button>
      )}

      {/* Dispatch button — only when ready, delivery, not yet dispatched */}
      {canCallCourier && !quote && (
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={handleRequestQuote}
          disabled={isQuoting}
        >
          <Truck className="h-4 w-4" />
          {isQuoting ? 'Считаем стоимость...' : 'Оформить доставку'}
        </Button>
      )}

      {/* Quote confirmation card */}
      {canCallCourier && quote && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Подтверждение доставки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Актуальная цена доставки:</span>
              <span className="font-medium">{formatPrice(quote.priceKopecks)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Оплачено в заказе:</span>
              <span>{formatPrice(order.deliveryCost)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Доплата:</span>
              <span>
                {quote.surchargeKopecks > 0 ? formatPrice(quote.surchargeKopecks) : 'не требуется'}
              </span>
            </div>
            {quote.surchargeKopecks > 0 && (
              <p className="text-xs text-muted-foreground">
                После подтверждения мы спишем доплату и сразу передадим заказ в доставку.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleConfirmClaim}
                disabled={isCreatingClaim || isPayingDoplata}
              >
                {isCreatingClaim || isPayingDoplata
                  ? 'Оформляем...'
                  : quote.surchargeKopecks > 0
                    ? `Доплатить ${formatPrice(quote.surchargeKopecks)} и передать в доставку`
                    : 'Передать в доставку'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setQuote(null)}
                disabled={isCreatingClaim || isPayingDoplata}
              >
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
