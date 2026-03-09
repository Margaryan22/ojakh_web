'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice, formatDate, formatDateFull } from '@/lib/format';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';
import { useAuthStore } from '@/stores/auth.store';
import type { Order, OrderStatus } from '@/types';
import { useState } from 'react';
import { AxiosError } from 'axios';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [isPaying, setIsPaying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const orderId = params.id as string;

  const { data: order, isLoading, refetch } = useQuery<Order>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}`);
      return data;
    },
    enabled: !!user && !!orderId,
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
    </div>
  );
}
