'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, RotateCcw } from 'lucide-react';
import { AxiosError } from 'axios';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice, formatDate } from '@/lib/format';
import { STATUS_LABELS, STATUS_COLORS, POLLING_INTERVAL_MS } from '@/lib/constants';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { FadeIn } from '@/components/motion/fade-in';
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger';
import type { Order, OrderStatus } from '@/types';

export default function OrdersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const prevStatusesRef = useRef<Record<number, string>>({});
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const fetchCart = useCartStore((s) => s.fetchCart);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders');
      return data;
    },
    enabled: !!user,
    refetchInterval: POLLING_INTERVAL_MS,
  });
  const orders: Order[] = useMemo(() => ordersData?.orders ?? [], [ordersData]);

  useEffect(() => {
    if (orders.length === 0) return;

    const prev = prevStatusesRef.current;
    const isFirstLoad = Object.keys(prev).length === 0;

    orders.forEach((order) => {
      const prevStatus = prev[order.id];
      if (!isFirstLoad && prevStatus && prevStatus !== order.status) {
        const label = STATUS_LABELS[order.status as OrderStatus] ?? order.status;
        const num = order.orderNumber ?? order.id;
        toast.info(`Заказ #${num}: статус изменён на "${label}"`);
      }
      prev[order.id] = order.status;
    });
  }, [orders]);

  const handleReorder = async (orderId: number) => {
    setReorderingId(orderId);
    try {
      const { data } = await api.post(`/orders/${orderId}/reorder`);
      await fetchCart();
      const added: number = data.added ?? 0;
      const skipped: string[] = data.skipped ?? [];
      if (added === 0) {
        toast.error('Товары из этого заказа сейчас недоступны');
        return;
      }
      if (skipped.length > 0) {
        toast.success(
          `Добавлено в корзину. Недоступно сейчас: ${skipped.join(', ')}`,
        );
      } else {
        toast.success('Товары добавлены в корзину');
      }
      router.push('/cart');
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Не удалось повторить заказ');
      } else {
        toast.error('Не удалось повторить заказ');
      }
    } finally {
      setReorderingId(null);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">Войдите в систему, чтобы просмотреть заказы</p>
        <Button onClick={() => router.push('/login')}>Войти</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <FadeIn>
        <h1 className="text-2xl font-bold">Мои заказы</h1>
      </FadeIn>

      {orders.length === 0 ? (
        <FadeIn delay={0.05}>
          <div className="text-center py-12 space-y-3">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">У вас пока нет заказов</p>
            <Button variant="outline" onClick={() => router.push('/catalog')}>
              Перейти в каталог
            </Button>
          </div>
        </FadeIn>
      ) : (
        <StaggerContainer immediate className="space-y-3">
          {orders.map((order) => (
            <StaggerItem key={order.id}>
              <Card
                className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow] duration-300 ease-out-soft"
                onClick={() => router.push(`/orders/${order.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Заказ #{order.orderNumber ?? order.id}</span>
                        <Badge className={STATUS_COLORS[order.status as OrderStatus]}>
                          {STATUS_LABELS[order.status as OrderStatus]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDate(order.deliveryDate)} &middot;{' '}
                        {order.isPickup ? 'Самовывоз' : 'Доставка'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {order.items.map((i) => i.name).join(', ')}
                      </p>
                    </div>
                    <span className="font-bold whitespace-nowrap">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                  {order.status !== 'new' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(order.id);
                      }}
                      disabled={reorderingId === order.id}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {reorderingId === order.id ? 'Добавляем...' : 'Заказать снова'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </div>
  );
}
