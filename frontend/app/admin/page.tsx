'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice, formatDate } from '@/lib/format';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';
import { FadeIn } from '@/components/motion/fade-in';
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger';
import type { Order, OrderStatus } from '@/types';
import { AxiosError } from 'axios';

const statusFilters: { value: string; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'paid', label: 'Оплачены' },
  { value: 'preparing', label: 'Готовятся' },
  { value: 'ready', label: 'Готовы' },
  { value: 'delivering', label: 'В доставке' },
  { value: 'completed', label: 'Завершены' },
  { value: 'cancelled', label: 'Отменены' },
];

export default function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data } = await api.get('/admin/orders');
      return data;
    },
  });

  const markReadyMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.patch(`/admin/orders/${orderId}/ready`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Заказ отмечен как готовый');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка');
      }
    },
  });

  const startCookingMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.patch(`/admin/orders/${orderId}/start-cooking`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Заказ начала готовить');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка');
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.patch(`/admin/orders/${orderId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Заказ отменён');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка');
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.patch(`/admin/orders/${orderId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Заказ завершён');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message ?? 'Ошибка');
      }
    },
  });

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter((o) => o.status === statusFilter);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const useStagger = filteredOrders.length <= 30;
  const ListWrapper: React.ElementType = useStagger ? StaggerContainer : 'div';
  const ItemWrapper: React.ElementType = useStagger ? StaggerItem : 'div';
  const listProps = useStagger ? { immediate: true } : {};

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-bold">Заказы</h1>
      </FadeIn>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {statusFilters.map((f) => (
            <TabsTrigger
              key={f.value}
              value={f.value}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-3 text-xs"
            >
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filteredOrders.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Нет заказов</p>
      ) : (
        <ListWrapper className="space-y-3" {...listProps}>
          {filteredOrders.map((order) => (
            <ItemWrapper key={order.id}>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">#{order.orderNumber ?? order.id}</span>
                      <Badge className={STATUS_COLORS[order.status as OrderStatus]}>
                        {STATUS_LABELS[order.status as OrderStatus]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(order as any).user?.name ?? `#${order.userId}`}
                      {(order as any).user?.phone ? ` · ${(order as any).user.phone}` : ''}
                      {' · '}{formatDate(order.deliveryDate)}
                      {order.deliveryTime ? ` ${order.deliveryTime}` : ''}
                      {' · '}{order.isPickup ? 'Самовывоз' : 'Доставка'}
                    </p>
                  </div>
                  <span className="font-bold">{formatPrice(order.total)}</span>
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5">
                  {order.items.map((item, idx) => (
                    <span key={idx}>
                      {item.name}
                      {item.flavor ? ` (${item.flavor})` : ''}
                      {' '}&times;{item.quantity}
                      {idx < order.items.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>

                {order.address && (
                  <p className="text-xs text-muted-foreground">
                    Адрес: {order.address}
                  </p>
                )}

                <div className="flex gap-2 flex-wrap">
                  {order.status === 'paid' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => startCookingMutation.mutate(order.id)}
                      disabled={startCookingMutation.isPending}
                    >
                      Начала готовить
                    </Button>
                  )}
                  {order.status === 'preparing' && (
                    <Button
                      size="sm"
                      onClick={() => markReadyMutation.mutate(order.id)}
                      disabled={markReadyMutation.isPending}
                    >
                      Отметить готовым
                    </Button>
                  )}
                  {order.status === 'ready' && order.isPickup && (
                    <Button
                      size="sm"
                      onClick={() => completeMutation.mutate(order.id)}
                      disabled={completeMutation.isPending}
                    >
                      Выдан клиенту
                    </Button>
                  )}
                  {order.status === 'delivering' && (
                    <Button
                      size="sm"
                      onClick={() => completeMutation.mutate(order.id)}
                      disabled={completeMutation.isPending}
                    >
                      Доставлен
                    </Button>
                  )}
                  {order.status !== 'cancelled' && order.status !== 'completed' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelMutation.mutate(order.id)}
                      disabled={cancelMutation.isPending}
                    >
                      Отменить
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            </ItemWrapper>
          ))}
        </ListWrapper>
      )}
    </div>
  );
}
